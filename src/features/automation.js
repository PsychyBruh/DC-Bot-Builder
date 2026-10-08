import { ChannelType, PermissionFlagsBits } from "discord.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { featureData, saveFeatures, resolveChannel, resolveRole, settingOn } from "./config.js";
import { getSettings, setSetting } from "../storage/serverSettings.js";
import { rollWeek, weekStats } from "./stats.js";

// ===================== ROBLOX GAME STATUS =====================
export async function fetchRobloxGame(universeId) {
  const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${encodeURIComponent(universeId)}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Roblox API ${res.status}`);
  const game = (await res.json()).data?.[0];
  if (!game) throw new Error("Universe not found");
  let votes = null;
  try {
    const v = await fetch(`https://games.roblox.com/v1/games/votes?universeIds=${encodeURIComponent(universeId)}`).then((r) => r.json());
    votes = v.data?.[0] || null;
  } catch {}
  return { ...game, votes };
}

function findCategory(guild, ref) {
  if (!ref) return null;
  return guild.channels.cache.get(ref) || guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "").includes(String(ref).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")));
}

export async function updateRobloxStatus(guild) {
  const s = getSettings(guild.id);
  if (!s.roblox_universe_id) return;
  const state = featureData(guild.id, "robloxStatus", {});
  let game = null;
  try { game = await fetchRobloxGame(s.roblox_universe_id); } catch (err) { console.error(`roblox status (${guild.name}):`, err.message); }
  // No data back = private / unavailable
  const offline = !game;
  const vcName = offline ? "🔴 Game offline" : `🟢 Players online: ${game.playing.toLocaleString()}`;

  // Locked voice channel showing the count (Discord allows ~2 renames per 10 min)
  let vc = s.status_voice_channel ? guild.channels.cache.get(s.status_voice_channel) : null;
  if (!vc) {
    const cat = findCategory(guild, s.status_category);
    vc = await guild.channels.create({
      name: vcName, type: ChannelType.GuildVoice, parent: cat?.id ?? null,
      permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.Connect] }],
    }).catch(() => null);
    if (vc) { setSetting(guild.id, "status_voice_channel", vc.id); await vc.setPosition(0).catch(() => {}); }
  } else if (vc.name !== vcName && Date.now() - (state.lastRename || 0) > 5 * 60000) {
    state.lastRename = Date.now();
    await vc.setName(vcName).catch(() => {});
  }

  // Game update detection → announce
  if (game?.updated) {
    if (state.lastUpdated && state.lastUpdated !== game.updated && settingOn(guild.id, "roblox_update_announce")) {
      const out = resolveChannel(guild, "updates_channel", ["updates", "patch-notes", "announcements"]);
      const ping = resolveRole(guild, "update_ping_role", ["update ping", "updates ping"]);
      if (out) await out.send({ content: `🛠️ **${game.name}** was just updated${ping ? ` ${ping}` : ""}`, allowedMentions: { roles: ping ? [ping.id] : [] } }).catch(() => {});
    }
    state.lastUpdated = game.updated;
  }

  // Auto-updating status embed
  const ch = resolveChannel(guild, "status_channel", ["status", "game-status", "server-status"]);
  if (!ch) { saveFeatures(); return; }
  let embed;
  if (offline) {
    embed = baseEmbed(COLORS.danger).setTitle("🔴 Game offline").setDescription("The game is private or unavailable right now.").setFooter({ text: "Updates every 5 minutes" });
  } else {
    const likes = game.votes ? `${Math.round((game.votes.upVotes / Math.max(1, game.votes.upVotes + game.votes.downVotes)) * 100)}% 👍` : "—";
    embed = baseEmbed(COLORS.success)
      .setTitle(`🟢 ${game.name}`)
      .setURL(`https://www.roblox.com/games/${game.rootPlaceId}`)
      .addFields(
        { name: "Status", value: "Online", inline: true },
        { name: "Players online", value: game.playing.toLocaleString(), inline: true },
        { name: "Visits", value: game.visits.toLocaleString(), inline: true },
        { name: "Favourites", value: (game.favoritedCount || 0).toLocaleString(), inline: true },
        { name: "Rating", value: likes, inline: true },
        { name: "Last update", value: `<t:${Math.floor(new Date(game.updated).getTime() / 1000)}:R>`, inline: true },
      )
      .setFooter({ text: "Updates every 5 minutes" });
  }
  let msg = state.messageId ? await ch.messages.fetch(state.messageId).catch(() => null) : null;
  if (msg) await msg.edit({ embeds: [embed] }).catch(() => {});
  else {
    msg = await ch.send({ embeds: [embed] }).catch(() => null);
    if (msg) state.messageId = msg.id;
  }
  saveFeatures();
}

// ===================== PATCH NOTES → ANNOUNCEMENT =====================
// Anything posted in the patch source channel (by a webhook from Roblox Studio/GitHub, or staff)
// gets reformatted into an embed in the updates channel with an Update Ping.
export function formatPatchNotes(raw, author) {
  let text = raw.trim();
  let title = null;
  const firstLine = text.split("\n")[0];
  if (/^#+\s/.test(firstLine) || firstLine.length < 80) { title = firstLine.replace(/^#+\s*/, "").replace(/\*\*/g, ""); text = text.split("\n").slice(1).join("\n").trim(); }
  // Normalise list bullets and markdown headings into Discord-friendly text
  text = text.replace(/^\s*[-*+]\s+/gm, "• ").replace(/^#{1,3}\s*(.+)$/gm, "**$1**");
  const embed = baseEmbed(COLORS.purple).setTitle(`📢 ${title || "New Update"}`).setDescription(text || raw);
  if (author) embed.setFooter({ text: `Posted by ${author}` });
  return embed;
}

export async function handlePatchSourceMessage(message) {
  if (!message.guild) return false;
  const src = resolveChannel(message.guild, "patch_source_channel", ["patch-notes-draft", "github-feed", "dev-feed"]);
  if (!src || message.channelId !== src.id) return false;
  if (message.author.id === message.client.user.id) return false;
  // Accept webhooks (Studio/GitHub) or staff posts, ignore chatter starting with "//"
  if (!message.webhookId && !message.member?.permissions?.has(PermissionFlagsBits.ManageMessages)) return false;
  if ((message.content || "").startsWith("//")) return false;
  const raw = message.content || message.embeds.map((e) => [e.title, e.description, ...(e.fields || []).map((f) => `**${f.name}**\n${f.value}`)].filter(Boolean).join("\n")).join("\n\n");
  if (!raw.trim()) return false;
  await postUpdate(message.guild, raw, message.author.username, [...message.attachments.values()].find((a) => /^image\//.test(a.contentType || ""))?.url);
  await message.react("✅").catch(() => {});
  return true;
}

export async function postUpdate(guild, raw, authorName, imageUrl) {
  const out = resolveChannel(guild, "updates_channel", ["updates", "patch-notes", "announcements"]);
  if (!out) return false;
  const ping = resolveRole(guild, "update_ping_role", ["update ping", "updates ping", "updates"]);
  const embed = formatPatchNotes(raw, authorName);
  if (imageUrl) embed.setImage(imageUrl);
  const msg = await out.send({ content: ping ? `${ping}` : undefined, embeds: [embed], allowedMentions: { roles: ping ? [ping.id] : [] } }).catch(() => null);
  if (msg && out.type === ChannelType.GuildAnnouncement) await msg.crosspost().catch(() => {});
  return !!msg;
}

// ===================== SCHEDULED POSTS =====================
// featureData "schedules": [{ id, every: "daily"|"weekly"|"monthly", day, time:"HH:MM" (UTC), channelId, message, ping?, lastRun }]
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function addSchedule(guildId, sched) {
  const list = featureData(guildId, "schedules", []);
  const id = Math.random().toString(36).slice(2, 7);
  list.push({ id, ...sched, lastRun: 0 });
  saveFeatures();
  return id;
}
export function removeSchedule(guildId, id) {
  const list = featureData(guildId, "schedules", []);
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return false;
  list.splice(i, 1);
  saveFeatures();
  return true;
}
export function listSchedules(guildId) { return featureData(guildId, "schedules", []); }

function isDue(s, now) {
  const [hh, mm] = (s.time || "12:00").split(":").map((n) => parseInt(n, 10));
  if (now.getUTCHours() !== hh || now.getUTCMinutes() < mm) return false;
  if (Date.now() - (s.lastRun || 0) < 20 * 3600000) return false; // once per day max
  if (s.every === "weekly") return DAYS[now.getUTCDay()] === String(s.day).slice(0, 3).toLowerCase();
  if (s.every === "monthly") return now.getUTCDate() === parseInt(s.day, 10);
  return true;
}

export async function runSchedules(client) {
  const now = new Date();
  for (const guild of client.guilds.cache.values()) {
    for (const s of featureData(guild.id, "schedules", [])) {
      if (!isDue(s, now)) continue;
      s.lastRun = Date.now();
      saveFeatures();
      const ch = guild.channels.cache.get(s.channelId);
      if (!ch) continue;
      if (s.kind === "sotw") { await screenshotOfTheWeek(guild, ch); continue; }
      const roles = [...(s.pings || []), ...(s.ping ? [s.ping] : [])].map((id) => guild.roles.cache.get(id)).filter(Boolean);
      const content = roles.length ? roles.map((r) => `${r}`).join(" ") : undefined;
      if (s.kind === "repost_latest") {
        // Re-post the newest message from a source channel (e.g. the event calendar)
        const src = guild.channels.cache.get(s.sourceChannelId);
        const latest = src ? (await src.messages.fetch({ limit: 1 }).catch(() => null))?.first() : null;
        if (!latest) continue;
        await ch.send({ content: [content, s.message].filter(Boolean).join("\n") || undefined, embeds: latest.embeds.length ? latest.embeds.map((e) => e.toJSON()) : [baseEmbed(COLORS.dark).setDescription(latest.content || "—")], allowedMentions: { roles: roles.map((r) => r.id) } }).catch(() => {});
        continue;
      }
      await ch.send({ content, embeds: [baseEmbed(COLORS.dark).setDescription(s.message)], allowedMentions: { roles: roles.map((r) => r.id) } }).catch(() => {});
    }
  }
}

// Top media from the screenshots channel over the last week → a poll.
export async function screenshotOfTheWeek(guild, postChannel) {
  const src = resolveChannel(guild, "sotw_channel", ["screenshots", "screenshot"]);
  if (!src) return;
  const since = Date.now() - 7 * 86400000;
  const candidates = [];
  let before;
  for (let i = 0; i < 10; i++) {
    const batch = await src.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch?.size) break;
    for (const m of batch.values()) {
      if (m.createdTimestamp < since) { i = 99; break; }
      const img = [...m.attachments.values()].find((a) => /^image\//.test(a.contentType || ""));
      if (!img || m.author.bot) continue;
      const score = m.reactions.cache.reduce((n, r) => n + r.count, 0);
      candidates.push({ m, img, score });
    }
    before = batch.last().id;
  }
  if (candidates.length < 2) return;
  // Rank by ⭐ reactions first, then all reactions
  const stars = (m) => m.reactions.cache.find((r) => r.emoji.name === (getSettings(guild.id).starboard_emoji || "⭐"))?.count || 0;
  const top = candidates.sort((a, b) => stars(b.m) - stars(a.m) || b.score - a.score).slice(0, 5);
  await postChannel.send({ embeds: [baseEmbed(COLORS.gold).setTitle("📸 Screenshot of the Week — vote!")
    .setDescription(top.map((c, i) => `**${i + 1}.** by ${c.m.author} — [view](${c.m.url})`).join("\n"))
    .setImage(top[0].img.url)], allowedMentions: { parse: [] } }).catch(() => {});
  const { postPoll } = await import("./voting.js");
  const poll = await postPoll(postChannel, { username: "Screenshot of the Week" }, "Which screenshot wins this week?", top.map((c, i) => `#${i + 1} ${c.m.member?.displayName || c.m.author.username}`.slice(0, 80)), 86400000);
  const p = featureData(guild.id, "polls", {})[poll.id];
  if (p) { p.sotw = top.map((c) => ({ userId: c.m.author.id, url: c.m.url, img: c.img.url })); saveFeatures(); }
}

// ===================== MEMBER COUNT CHANNELS =====================
// featureData "counters": [{ channelId, template: "👥 Members: {count}", kind: "members"|"humans"|"bots"|"boosts"|"role", roleId? }]
export async function counterValue(guild, c) {
  if (c.kind === "boosts") return guild.premiumSubscriptionCount || 0;
  if (c.kind === "members") return guild.memberCount;
  const members = guild.members.cache.size >= guild.memberCount * 0.9 ? guild.members.cache : await guild.members.fetch().catch(() => guild.members.cache);
  if (c.kind === "humans") return members.filter((m) => !m.user.bot).size;
  if (c.kind === "bots") return members.filter((m) => m.user.bot).size;
  if (c.kind === "role" || c.kind === "roles") {
    const ids = c.roleIds?.length ? c.roleIds : [c.roleId];
    return members.filter((m) => ids.some((id) => m.roles.cache.has(id))).size;
  }
  return guild.memberCount;
}

export async function updateCounters(guild) {
  const list = featureData(guild.id, "counters", []);
  for (const c of list) {
    const ch = guild.channels.cache.get(c.channelId);
    if (!ch) continue;
    const name = c.template.replace("{count}", (await counterValue(guild, c)).toLocaleString());
    if (ch.name !== name) await ch.setName(name).catch(() => {});
  }
}

export async function createCounter(guild, kind, template, roleIds, categoryRef) {
  const ids = Array.isArray(roleIds) ? roleIds : roleIds ? [roleIds] : [];
  const c = { kind: ids.length > 1 ? "roles" : kind, template, roleId: ids[0] || null, roleIds: ids };
  const cat = findCategory(guild, categoryRef || getSettings(guild.id).counter_category);
  const ch = await guild.channels.create({
    name: template.replace("{count}", (await counterValue(guild, c)).toLocaleString()),
    type: ChannelType.GuildVoice,
    parent: cat?.id ?? null,
    permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.Connect] }],
  });
  await ch.setPosition(0).catch(() => {});
  featureData(guild.id, "counters", []).push({ ...c, channelId: ch.id });
  saveFeatures();
  return ch;
}

// ===================== BIRTHDAYS =====================
// featureData "birthdays": { [userId]: "MM-DD" }, "birthdayState": { date, given: [userId] }
export async function runBirthdays(client) {
  const now = new Date();
  const today = `${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  for (const guild of client.guilds.cache.values()) {
    const bdays = featureData(guild.id, "birthdays", {});
    if (!Object.keys(bdays).length) continue;
    const state = featureData(guild.id, "birthdayState", { date: null, given: [] });
    if (state.date === today) continue;
    const hour = Number.isFinite(parseInt(getSettings(guild.id).birthday_hour, 10)) ? parseInt(getSettings(guild.id).birthday_hour, 10) : 12;
    if (now.getUTCHours() < hour) continue;
    const role = resolveRole(guild, "birthday_role", ["birthday", "birthday 🎂"]);
    // Take yesterday's birthday role away
    for (const uid of state.given || []) {
      const m = await guild.members.fetch(uid).catch(() => null);
      if (m && role) await m.roles.remove(role).catch(() => {});
    }
    state.date = today;
    state.given = [];
    const celebrants = Object.entries(bdays).filter(([, d]) => d === today || (today === "02-28" && d === "02-29" && now.getUTCFullYear() % 4 !== 0)).map(([u]) => u);
    const present = [];
    for (const uid of celebrants) {
      const m = await guild.members.fetch(uid).catch(() => null);
      if (!m) continue;
      present.push(uid);
      if (role) await m.roles.add(role, "birthday").catch(() => {});
    }
    state.given = present;
    saveFeatures();
    if (!present.length) continue;
    const ch = resolveChannel(guild, "birthday_channel", ["birthdays", "birthday", "general"]);
    if (ch) for (const u of present) await ch.send({ content: `🎂 Happy birthday <@${u}>!`, allowedMentions: { users: [u] } }).catch(() => {});
  }
}

// ===================== WEEKLY REPORT =====================
export async function runWeeklyReport(client) {
  const now = new Date();
  if (now.getUTCDay() !== 1 || now.getUTCHours() !== 9) return; // Mondays 09:00 UTC
  for (const guild of client.guilds.cache.values()) {
    const s = weekStats(guild.id);
    if (Date.now() - s.weekStart < 6 * 86400000) continue; // already rolled this week
    if (!settingOn(guild.id, "weekly_report")) { rollWeek(guild.id); continue; }
    const last = rollWeek(guild.id);
    const ch = resolveChannel(guild, "report_channel", ["admin-chat", "staff-chat", "admin"]);
    if (!ch) continue;
    const list = (obj, n = 10, fmt = (k, v) => `${k} — ${v}`) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v], i) => `${i + 1}. ${fmt(k, v)}`).join("\n") || "—";
    const avgResp = last.responseTimes?.length ? last.responseTimes.reduce((a, b) => a + b, 0) / last.responseTimes.length : null;
    const fmtDur = (ms) => (ms < 3600000 ? `${Math.round(ms / 60000)} min` : `${(ms / 3600000).toFixed(1)} h`);
    // warns / timeouts / bans per staff member
    const staffRows = {};
    for (const [k, n] of Object.entries(last.modActions || {})) {
      const [uid, act] = k.split(":");
      staffRows[uid] ??= {};
      staffRows[uid][act] = n;
    }
    const staffText = Object.entries(staffRows).slice(0, 15).map(([uid, a]) => `<@${uid}> — ${Object.entries(a).map(([k, n]) => `${n} ${k}${n === 1 ? "" : "s"}`).join(", ")}`).join("\n") || "—";
    const { topForumSuggestions } = await import("./forumSuggestions.js");
    const sugs = topForumSuggestions(guild.id, last.weekStart).map(([tid, x], i) => `${i + 1}. <#${tid}> — ✅ ${x.up.length} · ❌ ${x.down.length}`).join("\n") || "—";
    const e1 = baseEmbed(COLORS.dark).setTitle(`📊 Weekly report — ${guild.name}`).setDescription(`Week of <t:${Math.floor(last.weekStart / 1000)}:D>`)
      .addFields(
        { name: "📥 Joins", value: String(last.joins || 0), inline: true },
        { name: "📤 Leaves", value: String(last.leaves || 0), inline: true },
        { name: "📈 Net growth", value: String((last.joins || 0) - (last.leaves || 0)), inline: true },
        { name: "✅ Verifications", value: String(last.verifications || 0), inline: true },
        { name: "💬 Messages", value: Object.values(last.messages || {}).reduce((a, b) => a + b, 0).toLocaleString(), inline: true },
        { name: "🚨 Raid triggers", value: String(last.raids || 0), inline: true },
        { name: "🏆 Most active (XP gained)", value: list(last.xpGained, 10, (uid, v) => `<@${uid}> — ${v.toLocaleString()} XP`) },
      );
    const e2 = baseEmbed(COLORS.dark)
      .addFields(
        { name: "🎫 Tickets opened", value: list(last.ticketsOpenedByType, 10), inline: true },
        { name: "🔒 Tickets closed", value: list(last.ticketsClosedByType, 10), inline: true },
        { name: "⏱️ Avg first response", value: avgResp ? fmtDur(avgResp) : "—", inline: true },
        { name: "⚖️ Staff actions", value: staffText.slice(0, 1024) },
        { name: "🛡️ AutoMod hits by rule", value: list(last.automodByRule, 10) },
        { name: "💡 Top suggestions", value: sugs.slice(0, 1024) },
      );
    await ch.send({ embeds: [e1, e2], allowedMentions: { parse: [] } }).catch(() => {});
  }
}
