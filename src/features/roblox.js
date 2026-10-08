import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from "discord.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { featureData, saveFeatures, resolveChannel, resolveRole, canManageRole } from "./config.js";
import { getSettings } from "../storage/serverSettings.js";

// Linked accounts are global (one Roblox account per Discord user, works in every server):
// featureData("_global", "robloxLinks"): { [discordId]: { robloxId, username, linkedAt } }
// Pending codes:                        featureData("_global", "robloxPending"): { [discordId]: { robloxId, username, code, at } }
const WORDS = ["apple", "river", "storm", "nova", "comet", "rocket", "blaze", "frost", "orbit", "ember", "pixel", "turbo", "maple", "tiger", "cloud", "lemon", "piano", "coral", "falcon", "meadow"];

export function getLink(userId) {
  return featureData("_global", "robloxLinks", {})[userId] || null;
}

async function robloxUserByName(username) {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Roblox API ${res.status}`);
  return (await res.json()).data?.[0] || null;
}

async function robloxProfile(id) {
  const res = await fetch(`https://users.roblox.com/v1/users/${id}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Roblox API ${res.status}`);
  return res.json();
}

// Step 1: hand the user a code to put in their Roblox profile "About".
export async function startLink(userId, username) {
  const user = await robloxUserByName(username);
  if (!user) return { error: `No Roblox user named **${username}**.` };
  const code = Array.from({ length: 4 }, () => WORDS[Math.floor(Math.random() * WORDS.length)]).join(" ");
  featureData("_global", "robloxPending", {})[userId] = { robloxId: user.id, username: user.name, code, at: Date.now() };
  saveFeatures();
  return { code, username: user.name, robloxId: user.id };
}

// Step 2: check the code is in their profile, then link + give roles in this server.
export async function finishLink(member) {
  const pending = featureData("_global", "robloxPending", {});
  const p = pending[member.id];
  if (!p) return { error: "Start with `!link <roblox username>` first." };
  if (Date.now() - p.at > 30 * 60000) { delete pending[member.id]; saveFeatures(); return { error: "That code expired — run `!link <username>` again." }; }
  const profile = await robloxProfile(p.robloxId);
  if (!(profile.description || "").toLowerCase().includes(p.code)) {
    return { error: `I couldn't find \`${p.code}\` in the About section of **${p.username}**. Save it on Roblox, wait a few seconds, then try again.` };
  }
  const taken = Object.entries(featureData("_global", "robloxLinks", {})).find(([did, l]) => l.robloxId === p.robloxId && did !== member.id);
  if (taken) return { error: "That Roblox account is already linked to another Discord user." };
  featureData("_global", "robloxLinks", {})[member.id] = { robloxId: p.robloxId, username: p.username, linkedAt: Date.now() };
  delete pending[member.id];
  saveFeatures();
  await applyLinkRoles(member);
  return { username: p.username, robloxId: p.robloxId };
}

export function unlink(userId) {
  const links = featureData("_global", "robloxLinks", {});
  const had = !!links[userId];
  delete links[userId];
  saveFeatures();
  return had;
}

// Linked role + achievement roles (Roblox badge owned → role)
// featureData(guild, "achievements"): [{ badgeId, roleId, name }]
export async function applyLinkRoles(member) {
  const link = getLink(member.id);
  if (!link) return [];
  const gained = [];
  const linked = resolveRole(member.guild, "linked_role", ["linked", "roblox linked", "verified roblox"]);
  if (linked && canManageRole(member.guild, linked) && !member.roles.cache.has(linked.id)) {
    await member.roles.add(linked, "Roblox linked").catch(() => {});
    gained.push(linked.name);
  }
  const achievements = featureData(member.guild.id, "achievements", []);
  if (!achievements.length) return gained;
  const ids = achievements.map((a) => a.badgeId).join(",");
  try {
    const res = await fetch(`https://badges.roblox.com/v1/users/${link.robloxId}/badges/awarded-dates?badgeIds=${ids}`, { signal: AbortSignal.timeout(10_000) });
    const owned = new Set(((await res.json()).data || []).map((b) => String(b.badgeId)));
    for (const a of achievements) {
      const role = member.guild.roles.cache.get(a.roleId);
      if (!role || !canManageRole(member.guild, role)) continue;
      if (owned.has(String(a.badgeId)) && !member.roles.cache.has(role.id)) {
        await member.roles.add(role, `Roblox badge ${a.badgeId}`).catch(() => {});
        gained.push(role.name);
      }
    }
  } catch (err) {
    console.error("achievement sync failed:", err.message);
  }
  return gained;
}

// Daily: re-check achievements for everyone linked in each server.
export async function syncAllAchievements(client) {
  const links = featureData("_global", "robloxLinks", {});
  for (const guild of client.guilds.cache.values()) {
    if (!featureData(guild.id, "achievements", []).length && !resolveRole(guild, "linked_role", ["linked"])) continue;
    for (const uid of Object.keys(links)) {
      const m = guild.members.cache.get(uid) || await guild.members.fetch(uid).catch(() => null);
      if (m) await applyLinkRoles(m);
      await new Promise((r) => setTimeout(r, 300)); // be gentle with the Roblox API
    }
  }
}

// ===================== IN-GAME LEADERBOARDS =====================
// featureData(guild, "leaderboards"): [{ store, title, scope?, ascending?, format?: "time"|"number" }]
// Reads Roblox OrderedDataStores via Open Cloud. API key: env ROBLOX_API_KEY (or per-server ROBLOX_API_KEY_<guildId>).
function fmt(v, format) {
  if (format !== "time") return Number(v).toLocaleString();
  const ms = Number(v); // stored as milliseconds
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), cs = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

async function readOrderedStore(universeId, apiKey, lb) {
  const params = new URLSearchParams({ max_page_size: "10", order_by: lb.ascending ? "asc" : "desc" });
  const url = `https://apis.roblox.com/ordered-data-stores/v1/universes/${universeId}/orderedDataStores/${encodeURIComponent(lb.store)}/scopes/${encodeURIComponent(lb.scope || "global")}/entries?${params}`;
  const res = await fetch(url, { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Open Cloud ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return (await res.json()).entries || [];
}

export async function postLeaderboards(guild) {
  const s = getSettings(guild.id);
  const boards = featureData(guild.id, "leaderboards", []);
  const apiKey = process.env[`ROBLOX_API_KEY_${guild.id}`] || process.env.ROBLOX_API_KEY;
  if (!boards.length || !s.roblox_universe_id || !apiKey) return { error: "Needs roblox_universe_id, at least one leaderboard, and ROBLOX_API_KEY in .env" };
  const ch = resolveChannel(guild, "leaderboard_channel", ["leaderboards", "leaderboard", "records"]);
  if (!ch) return { error: "No leaderboard channel." };
  const embeds = [];
  for (const lb of boards) {
    try {
      const entries = await readOrderedStore(s.roblox_universe_id, apiKey, lb);
      // Keys are usually Roblox user IDs — resolve to usernames in one call
      const ids = entries.map((e) => parseInt(e.id, 10)).filter(Boolean);
      let names = {};
      if (ids.length) {
        const r = await fetch("https://users.roblox.com/v1/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: ids }) }).then((x) => x.json()).catch(() => ({}));
        names = Object.fromEntries((r.data || []).map((u) => [String(u.id), u.name]));
      }
      const medals = ["🥇", "🥈", "🥉"];
      embeds.push(baseEmbed(COLORS.gold).setTitle(`🏁 ${lb.title || lb.store}`).setDescription(
        entries.length ? entries.map((e, i) => `${medals[i] || `**${i + 1}.**`} ${names[e.id] || e.id} — **${fmt(e.value, lb.format)}**`).join("\n") : "No records yet."));
    } catch (err) {
      embeds.push(baseEmbed(COLORS.danger).setTitle(`🏁 ${lb.title || lb.store}`).setDescription(`Couldn't load: ${err.message}`));
    }
  }
  for (let i = 0; i < embeds.length; i += 10) await ch.send({ embeds: embeds.slice(i, i + 10) }).catch(() => {});
  return { ok: true };
}

export async function runDailyLeaderboards(client) {
  const now = new Date();
  for (const guild of client.guilds.cache.values()) {
    const state = featureData(guild.id, "leaderboardState", {});
    const hour = parseInt(getSettings(guild.id).leaderboard_hour, 10);
    const postHour = Number.isFinite(hour) ? hour : 18;
    const today = now.toISOString().slice(0, 10);
    if (state.lastPosted === today || now.getUTCHours() !== postHour) continue;
    if (!featureData(guild.id, "leaderboards", []).length) continue;
    state.lastPosted = today;
    saveFeatures();
    await postLeaderboards(guild);
  }
}

// ===================== PLAYTESTS =====================
// featureData(guild, "playtests"): { [messageId]: { at, durationMin, notes, channelId, going: [], reminded, opened, closed, hostId } }
export function parseWhen(text) {
  text = text.trim();
  let m = /^in\s+(\d+)\s*(m|min|minutes?|h|hours?|d|days?)$/i.exec(text);
  if (m) return Date.now() + parseInt(m[1], 10) * (m[2][0].toLowerCase() === "m" ? 60000 : m[2][0].toLowerCase() === "h" ? 3600000 : 86400000);
  m = /^<t:(\d+)(:\w)?>$/.exec(text) || /^(\d{10})$/.exec(text);
  if (m) return parseInt(m[1], 10) * 1000;
  m = /^(\d{4}-\d{2}-\d{2})[ t](\d{1,2}:\d{2})$/i.exec(text); // UTC
  if (m) { const t = Date.parse(`${m[1]}T${m[2].padStart(5, "0")}:00Z`); return Number.isFinite(t) ? t : null; }
  return null;
}

function playtestEmbed(p, guild) {
  return baseEmbed(p.closed ? COLORS.dark : COLORS.cyan).setTitle("🧪 Playtest")
    .setDescription(`**When:** <t:${Math.floor(p.at / 1000)}:F> (<t:${Math.floor(p.at / 1000)}:R>)\n**Length:** ${p.durationMin} min${p.notes ? `\n\n${p.notes}` : ""}\n\n**Going (${p.going.length}):** ${p.going.length ? p.going.map((u) => `<@${u}>`).join(", ").slice(0, 900) : "nobody yet"}`)
    .setFooter({ text: p.closed ? "Playtest finished" : "Click I'm in to get pinged when it starts" });
}

function playtestRow(p) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("pt:join").setLabel("I'm in").setEmoji("✋").setStyle(ButtonStyle.Success).setDisabled(!!p.closed),
    new ButtonBuilder().setCustomId("pt:leave").setLabel("Can't make it").setStyle(ButtonStyle.Secondary).setDisabled(!!p.closed),
  );
}

export async function createPlaytest(guild, host, at, durationMin, notes) {
  const ch = resolveChannel(guild, "playtest_channel", ["playtests", "playtest", "tester-announcements"]);
  if (!ch) return { error: "No playtest channel — set `playtest_channel`." };
  const tester = resolveRole(guild, "tester_role", ["tester", "testers", "playtester"]);
  const p = { at, durationMin, notes, channelId: ch.id, going: [], reminded: false, opened: false, closed: false, hostId: host.id };
  const msg = await ch.send({ content: tester ? `${tester} new playtest scheduled!` : undefined, embeds: [playtestEmbed(p, guild)], components: [playtestRow(p)], allowedMentions: { roles: tester ? [tester.id] : [] } });
  featureData(guild.id, "playtests", {})[msg.id] = p;
  saveFeatures();
  return { message: msg };
}

export async function handlePlaytestButton(interaction) {
  const p = featureData(interaction.guildId, "playtests", {})[interaction.message.id];
  if (!p || p.closed) return interaction.reply({ content: "This playtest is over.", ephemeral: true });
  const uid = interaction.user.id;
  const join = interaction.customId === "pt:join";
  p.going = p.going.filter((u) => u !== uid);
  if (join) p.going.push(uid);
  saveFeatures();
  return interaction.update({ embeds: [playtestEmbed(p, interaction.guild)], components: [playtestRow(p)] });
}

async function setTesterVc(guild, open) {
  const s = getSettings(guild.id);
  const vc = s.tester_vc ? guild.channels.cache.get(s.tester_vc)
    : guild.channels.cache.find((c) => c.isVoiceBased() && /tester|playtest|testing/i.test(c.name));
  const tester = resolveRole(guild, "tester_role", ["tester", "testers", "playtester"]);
  if (!vc || !tester) return null;
  await vc.permissionOverwrites.edit(tester.id, { ViewChannel: true, Connect: open }, { reason: open ? "playtest started" : "playtest ended" }).catch(() => {});
  return vc;
}

// Scheduler: 30-min reminder, open the VC at start, close it after the duration.
export async function runPlaytests(client) {
  for (const guild of client.guilds.cache.values()) {
    const all = featureData(guild.id, "playtests", {});
    for (const [msgId, p] of Object.entries(all)) {
      if (p.closed) { if (Date.now() - p.at > 14 * 86400000) { delete all[msgId]; saveFeatures(); } continue; }
      const ch = guild.channels.cache.get(p.channelId);
      const tester = resolveRole(guild, "tester_role", ["tester", "testers", "playtester"]);
      if (!p.reminded && Date.now() >= p.at - 30 * 60000) {
        p.reminded = true; saveFeatures();
        const mentions = [tester ? `${tester}` : "", ...p.going.map((u) => `<@${u}>`)].filter(Boolean).join(" ");
        await ch?.send({ content: `⏰ Playtest starts <t:${Math.floor(p.at / 1000)}:R>! ${mentions}`.slice(0, 1900), allowedMentions: { roles: tester ? [tester.id] : [], users: p.going } }).catch(() => {});
      }
      if (!p.opened && Date.now() >= p.at) {
        p.opened = true; saveFeatures();
        const vc = await setTesterVc(guild, true);
        await ch?.send({ content: `🧪 The playtest is **live**!${vc ? ` Join ${vc}` : ""}`, allowedMentions: { parse: [] } }).catch(() => {});
      }
      if (p.opened && Date.now() >= p.at + p.durationMin * 60000) {
        p.closed = true; saveFeatures();
        await setTesterVc(guild, false);
        const msg = ch ? await ch.messages.fetch(msgId).catch(() => null) : null;
        if (msg) await msg.edit({ embeds: [playtestEmbed(p, guild)], components: [playtestRow(p)] }).catch(() => {});
        await ch?.send("✅ Playtest finished — thanks for testing! Report bugs in the bug forum.").catch(() => {});
      }
    }
  }
}

export { PermissionFlagsBits };
