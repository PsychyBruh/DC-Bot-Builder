import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } from "discord.js";
import jsQR from "jsqr";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import {
  featureData, saveFeatures, resolveRole, resolveChannels, isStaff, settingOn, settingNum, staffAlert, canManageRole,
} from "./config.js";
import { getSettings } from "../storage/serverSettings.js";
import { logMod } from "./logging.js";
import { bump } from "./stats.js";

// ======================= ANTI-RAID =======================
const recentJoins = new Map(); // guildId -> [timestamps]

export function raidState(guildId) {
  return featureData(guildId, "raid", { locked: false, until: 0, slowmodes: {} });
}

export async function onMemberJoinRaidCheck(member) {
  const g = member.guild;
  if (!settingOn(g.id, "antiraid_enabled")) return;
  const windowMs = settingNum(g.id, "raid_window_seconds", 30) * 1000;
  const threshold = settingNum(g.id, "raid_join_threshold", 10);
  const now = Date.now();
  const list = (recentJoins.get(g.id) || []).filter((t) => now - t < windowMs);
  list.push(now);
  recentJoins.set(g.id, list);
  if (list.length >= Math.max(3, Math.ceil(threshold / 2))) { raidState(g.id).lastBurstAt = now; saveFeatures(); }
  if (list.length >= threshold && !raidState(g.id).locked) {
    await startLockdown(g, `${list.length} joins in ${windowMs / 1000}s`);
  }
}

export async function startLockdown(guild, reason, byUser = null) {
  const state = raidState(guild.id);
  if (state.locked) return false;
  const minutes = settingNum(guild.id, "raid_lock_minutes", 10);
  state.locked = true;
  state.until = Date.now() + minutes * 60000;
  state.slowmodes = {};
  saveFeatures();
  // Slow every text channel the bot can manage (remember the old slowmode to restore it)
  for (const ch of guild.channels.cache.values()) {
    if (ch.type !== ChannelType.GuildText) continue;
    if (!ch.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.ManageChannels)) continue;
    state.slowmodes[ch.id] = ch.rateLimitPerUser || 0;
    if ((ch.rateLimitPerUser || 0) < 30) await ch.setRateLimitPerUser(30, "anti-raid lockdown").catch(() => {});
  }
  saveFeatures();
  const staff = resolveRole(guild, "staff_role", ["staff", "moderator", "mod"]);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("raid:unlock").setLabel("Unlock now").setEmoji("🔓").setStyle(ButtonStyle.Success),
  );
  await staffAlert(guild, {
    content: staff ? `${staff}` : undefined,
    embeds: [baseEmbed(COLORS.danger).setTitle("🚨 RAID MODE ON").setDescription(
      `**Trigger:** ${reason}${byUser ? ` (by ${byUser})` : ""}\n\n• Verification is **locked**\n• All channels set to **30s slowmode**\n\nAuto-unlocks <t:${Math.floor(state.until / 1000)}:R>, or press **Unlock now** / run \`!raid off\`.`)],
    components: [row],
    allowedMentions: { roles: staff ? [staff.id] : [] },
  });
  await logMod(guild, baseEmbed(COLORS.danger).setTitle("🚨 Raid lockdown started").setDescription(reason));
  return true;
}

export async function endLockdown(guild, byUser = null) {
  const state = raidState(guild.id);
  if (!state.locked) return false;
  for (const [id, prev] of Object.entries(state.slowmodes || {})) {
    const ch = guild.channels.cache.get(id);
    if (ch) await ch.setRateLimitPerUser(prev, "anti-raid lockdown ended").catch(() => {});
  }
  state.locked = false;
  state.until = 0;
  state.slowmodes = {};
  saveFeatures();
  await staffAlert(guild, { embeds: [baseEmbed(COLORS.success).setTitle("🔓 Raid mode off").setDescription(byUser ? `Unlocked by ${byUser}.` : "Unlocked automatically.")] });
  await logMod(guild, baseEmbed(COLORS.success).setTitle("🔓 Raid lockdown ended").setDescription(byUser ? `By ${byUser}` : "Automatic"));
  return true;
}

export async function handleRaidButton(interaction) {
  if (!isStaff(interaction.member)) return interaction.reply({ content: "Staff only.", ephemeral: true });
  const ok = await endLockdown(interaction.guild, interaction.user);
  return interaction.reply({ content: ok ? "🔓 Lockdown lifted." : "Not in lockdown.", ephemeral: true });
}

export async function checkLockdownExpiry(client) {
  for (const guild of client.guilds.cache.values()) {
    const s = featureData(guild.id, "raid", { locked: false });
    if (s.locked && s.until && Date.now() > s.until) await endLockdown(guild);
  }
}

// ======================= ANTI-NUKE =======================
const nukeActions = new Map(); // `${guildId}:${userId}` -> [{ kind, at }]

export async function recordDestructive(guild, executor, kind) {
  if (!executor || !settingOn(guild.id, "antinuke_enabled")) return;
  if (executor.id === guild.ownerId || executor.id === guild.client.user.id) return;
  const whitelist = (getSettings(guild.id).antinuke_whitelist || "").split(",").map((s) => s.trim());
  if (whitelist.includes(executor.id)) return;
  const key = `${guild.id}:${executor.id}`;
  const now = Date.now();
  const list = (nukeActions.get(key) || []).filter((a) => now - a.at < 60000);
  list.push({ kind, at: now });
  nukeActions.set(key, list);
  const deletes = list.filter((a) => a.kind === "channel" || a.kind === "role").length;
  const bans = list.filter((a) => a.kind === "ban").length;
  const delLimit = settingNum(guild.id, "antinuke_delete_threshold", 3);
  const banLimit = settingNum(guild.id, "antinuke_ban_threshold", 5);
  if (deletes < delLimit && bans < banLimit) return;
  nukeActions.delete(key);

  // Strip every role the bot is able to remove
  const member = await guild.members.fetch(executor.id).catch(() => null);
  const stripped = [];
  if (member) {
    for (const role of member.roles.cache.values()) {
      if (role.id === guild.id || !canManageRole(guild, role)) continue;
      if (await member.roles.remove(role, "anti-nuke").then(() => true).catch(() => false)) stripped.push(role.name);
    }
  }
  const lead = resolveRole(guild, "leadership_role", ["leadership", "owner", "owners", "admin"]);
  await staffAlert(guild, {
    content: lead ? `${lead}` : `<@${guild.ownerId}>`,
    embeds: [baseEmbed(COLORS.danger).setTitle("☢️ ANTI-NUKE TRIGGERED").setDescription(
      `${executor} (${executor.tag}) did **${deletes}** channel/role deletions and **${bans}** bans in under a minute.\n\n` +
      (stripped.length ? `**Removed roles:** ${stripped.join(", ")}` : "⚠️ I couldn't remove their roles (their role is above mine). **Act now.**") +
      "\n\nIf their account was compromised, reset their password/2FA before giving roles back.")],
    allowedMentions: { roles: lead ? [lead.id] : [], users: lead ? [] : [guild.ownerId] },
  });
  await logMod(guild, baseEmbed(COLORS.danger).setTitle("☢️ Anti-nuke").setDescription(`${executor.tag} — roles stripped: ${stripped.join(", ") || "none"}`));
}

// ======================= NEW-ACCOUNT VERIFY CHECK =======================
export function needsAltReview(member) {
  const days = settingNum(member.guild.id, "min_account_age_days", 3);
  if (!days) return false;
  return Date.now() - member.user.createdTimestamp < days * 86400000;
}

export async function requestAltApproval(member) {
  const pending = featureData(member.guild.id, "altPending", {});
  if (pending[member.id]) return false;
  pending[member.id] = Date.now();
  saveFeatures();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`alt:ok:${member.id}`).setLabel("Approve").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`alt:kick:${member.id}`).setLabel("Kick").setEmoji("👢").setStyle(ButtonStyle.Danger),
  );
  await staffAlert(member.guild, {
    embeds: [baseEmbed(COLORS.warning).setTitle("🕵️ New account wants to verify").setThumbnail(member.user.displayAvatarURL())
      .setDescription(`${member} (${member.user.tag})\n**Account created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n**Joined:** <t:${Math.floor((member.joinedTimestamp || Date.now()) / 1000)}:R>`)],
    components: [row],
  });
  return true;
}

export async function handleAltButton(interaction) {
  if (!isStaff(interaction.member)) return interaction.reply({ content: "Staff only.", ephemeral: true });
  const [, action, userId] = interaction.customId.split(":");
  const pending = featureData(interaction.guildId, "altPending", {});
  delete pending[userId];
  saveFeatures();
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) return interaction.update({ content: "They already left.", embeds: interaction.message.embeds, components: [] });
  if (action === "ok") {
    const { verifyRole } = await import("./roles.js");
    const role = verifyRole(interaction.guild);
    if (role) await member.roles.add(role, `alt check approved by ${interaction.user.tag}`).catch(() => {});
    const unverified = resolveRole(interaction.guild, "unverified_role", ["unverified"]);
    if (unverified) await member.roles.remove(unverified).catch(() => {});
    await member.send(`✅ You've been verified in **${interaction.guild.name}**.`).catch(() => {});
  } else {
    await member.kick(`alt check: kicked by ${interaction.user.tag}`).catch(() => {});
  }
  return interaction.update({ content: `${action === "ok" ? "✅ Approved" : "👢 Kicked"} by ${interaction.user}`, embeds: interaction.message.embeds, components: [] });
}

// ======================= SCAM / PHISHING =======================
const LEGIT = new Set([
  "discord.com", "discord.gg", "discord.gift", "discordapp.com", "discordapp.net", "discord.media", "discordstatus.com",
  "roblox.com", "rbxcdn.com", "steamcommunity.com", "steampowered.com", "tenor.com", "giphy.com", "youtube.com", "youtu.be",
]);
const KNOWN_BAD = [
  "discord-nitro", "nitro-discord", "discordnitro", "dlscord", "discorcl", "discrod", "disocrd", "dicsord", "d1scord", "discordd",
  "discord-gift", "discordgift", "dlscord-gift", "steamcommunlty", "steamcomunity", "stearncommunity", "steamcommnuity", "steam-community",
  "robiox", "roblox-free", "free-robux", "robux-free", "rbxgift", "roblox.com.", "grabify", "iplogger", "2no.co", "blasze",
];
const BAIT = /(free\s*(nitro|robux|discord\s*nitro|skins?|vbucks)|nitro\s*(for\s*)?free|airdrop|claim\s*(your|ur)\s*(gift|nitro|reward)|steam\s*gift|@everyone.*(gift|nitro))/i;
const URL_RE = /https?:\/\/([^\s/<>"]+)[^\s<>"]*/gi;

function suspiciousHost(host) {
  host = host.toLowerCase().replace(/^www\./, "");
  if (LEGIT.has(host) || [...LEGIT].some((d) => host.endsWith("." + d))) return false;
  if (KNOWN_BAD.some((b) => host.includes(b))) return true;
  // Lookalikes of brands scammers impersonate
  return /(d[i1l]sc[o0]r[dcl]|n[i1]tr[o0]|st[e3]a?m.?c[o0]m|r[o0]bl[o0]x|r[o0]bux)/.test(host);
}

async function qrInImage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const img = await loadImage(Buffer.from(await res.arrayBuffer()));
    const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
    const c = createCanvas(w, h);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    return jsQR(new Uint8ClampedArray(data.data), w, h)?.data || null;
  } catch { return null; }
}

async function punish(message, reason, timeoutMs) {
  bump(message.guild.id, "automodHits");
  await message.delete().catch(() => {});
  if (timeoutMs && message.member?.moderatable) await message.member.timeout(timeoutMs, reason).catch(() => {});
  await logMod(message.guild, baseEmbed(COLORS.danger).setTitle("🛡️ AutoMod").setDescription(
    `**User:** ${message.author} (${message.author.tag})\n**Channel:** <#${message.channelId}>\n**Reason:** ${reason}${timeoutMs ? `\n**Timeout:** ${Math.round(timeoutMs / 60000)} min` : ""}\n\n>>> ${(message.content || "*(attachment)*").slice(0, 900)}`));
}

// Returns true if the message was removed.
export async function runAutoMod(message) {
  if (!message.guild || message.author.bot || !message.member) return false;
  if (isStaff(message.member)) return false;
  const gid = message.guild.id;

  // --- scams ---
  if (settingOn(gid, "scam_filter")) {
    const hosts = [...(message.content || "").matchAll(URL_RE)].map((m) => m[1]);
    const badHost = hosts.find(suspiciousHost);
    if (badHost || (hosts.length && BAIT.test(message.content))) {
      await punish(message, `Scam/phishing link (${badHost || "bait text + link"})`, 60 * 60000);
      await message.author.send(`⚠️ Your message in **${message.guild.name}** was removed because it contained a scam link. If you didn't send it, your account may be compromised — change your password and enable 2FA.`).catch(() => {});
      return true;
    }
    const images = [...message.attachments.values()].filter((a) => /^image\//.test(a.contentType || "") && a.size < 4_000_000);
    for (const img of images.slice(0, 3)) {
      const qr = await qrInImage(img.url);
      if (qr) {
        await punish(message, `QR code image (${qr.slice(0, 80)})`, 60 * 60000);
        await message.author.send(`⚠️ Your image in **${message.guild.name}** was removed: QR codes aren't allowed (they're a common account-stealing scam).`).catch(() => {});
        return true;
      }
    }
  }

  // --- mention spam ---
  const limit = settingNum(gid, "mention_spam_limit", 5);
  if (limit > 0) {
    const unique = new Set(message.mentions.users.filter((u) => u.id !== message.author.id).map((u) => u.id));
    if (unique.size >= limit) {
      await punish(message, `Mention spam (${unique.size} users)`, 10 * 60000);
      return true;
    }
  }

  // --- caps / emoji spam (only in the listed channels) ---
  const spamChannels = resolveChannels(message.guild, "spam_filter_channels", ["general", "chat"]);
  if (spamChannels.some((c) => c.id === message.channelId)) {
    const text = message.content || "";
    const letters = text.replace(/[^a-zA-Z]/g, "");
    const caps = letters.replace(/[^A-Z]/g, "").length;
    const emojis = (text.match(/\p{Extended_Pictographic}|<a?:\w+:\d+>/gu) || []).length;
    const capsSpam = letters.length >= 15 && caps / letters.length > 0.75;
    const emojiSpam = emojis >= 12;
    if (capsSpam || emojiSpam) {
      bump(gid, "automodHits");
      await message.delete().catch(() => {});
      const note = await message.channel.send({ content: `${message.author}, please don't spam ${capsSpam ? "caps" : "emojis"}.`, allowedMentions: { users: [message.author.id] } }).catch(() => null);
      if (note) setTimeout(() => note.delete().catch(() => {}), 6000);
      return true;
    }
  }
  return false;
}

// ======================= WARNINGS =======================
// featureData "warnings": { [userId]: [{ id, reason, by, at }] }
export function activeWarnings(guildId, userId) {
  const days = settingNum(guildId, "warn_expiry_days", 30);
  const list = featureData(guildId, "warnings", {})[userId] || [];
  return list.filter((w) => Date.now() - w.at < days * 86400000);
}

function parseThresholds(guildId) {
  const raw = getSettings(guildId).warn_thresholds || "3:1h,5:1d,7:ban";
  return raw.split(",").map((p) => {
    const [n, act] = p.split(":").map((s) => s.trim().toLowerCase());
    const m = /^(\d+)(m|h|d)$/.exec(act || "");
    return { count: parseInt(n, 10), action: act === "ban" ? "ban" : act === "kick" ? "kick" : "timeout", ms: m ? parseInt(m[1], 10) * { m: 60000, h: 3600000, d: 86400000 }[m[2]] : 0 };
  }).filter((t) => t.count > 0).sort((a, b) => a.count - b.count);
}

export async function addWarning(guild, target, moderator, reason) {
  const all = featureData(guild.id, "warnings", {});
  all[target.id] ??= [];
  const id = Math.random().toString(36).slice(2, 7);
  all[target.id].push({ id, reason: reason || "No reason given", by: moderator.id, at: Date.now() });
  saveFeatures();
  bump(guild.id, "warnings");
  const count = activeWarnings(guild.id, target.id).length;
  const step = parseThresholds(guild.id).filter((t) => t.count === count).pop();
  let actionText = "";
  const member = await guild.members.fetch(target.id).catch(() => null);
  if (step && member) {
    const why = `Reached ${count} warnings`;
    if (step.action === "ban") { await member.ban({ reason: why }).catch(() => {}); actionText = "🔨 Banned"; }
    else if (step.action === "kick") { await member.kick(why).catch(() => {}); actionText = "👢 Kicked"; }
    else if (step.ms) { await member.timeout(Math.min(step.ms, 28 * 86400000), why).catch(() => {}); actionText = `🔇 Timed out for ${step.ms >= 86400000 ? `${step.ms / 86400000}d` : step.ms >= 3600000 ? `${step.ms / 3600000}h` : `${step.ms / 60000}m`}`; }
  }
  await target.send(`⚠️ You were warned in **${guild.name}**: ${reason || "No reason given"}\nYou have **${count}** active warning(s).${actionText ? `\nAction taken: ${actionText}` : ""}`).catch(() => {});
  await logMod(guild, baseEmbed(COLORS.warning).setTitle("⚠️ Warning issued").setDescription(
    `**User:** ${target} (${target.tag})\n**By:** ${moderator}\n**Reason:** ${reason || "none"}\n**Active strikes:** ${count}${actionText ? `\n**Auto-action:** ${actionText}` : ""}\n**Warning ID:** \`${id}\``));
  return { id, count, actionText };
}

export function removeWarning(guildId, userId, warnId) {
  const all = featureData(guildId, "warnings", {});
  const list = all[userId] || [];
  const i = list.findIndex((w) => w.id === warnId);
  if (i < 0) return false;
  list.splice(i, 1);
  saveFeatures();
  return true;
}

export function clearWarnings(guildId, userId) {
  const all = featureData(guildId, "warnings", {});
  const n = (all[userId] || []).length;
  delete all[userId];
  saveFeatures();
  return n;
}
