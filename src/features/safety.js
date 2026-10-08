import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, GuildVerificationLevel } from "discord.js";
import jsQR from "jsqr";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import {
  featureData, saveFeatures, resolveRole, resolveRoles, resolveChannel, resolveChannels, isStaff, settingOn, settingNum,
  staffAlert, canManageRole, memberAtLeast, memberHasAny,
} from "./config.js";
import { getSettings } from "../storage/serverSettings.js";
import { logMod } from "./logging.js";
import { bump, bumpMap } from "./stats.js";

// ======================= ANTI-RAID =======================
const recentJoins = new Map(); // guildId -> [{ at, id, young }]

export function raidState(guildId) {
  return featureData(guildId, "raid", { locked: false, until: 0, slowmodes: {} });
}

export async function onMemberJoinRaidCheck(member) {
  const g = member.guild;
  if (!settingOn(g.id, "antiraid_enabled")) return;
  const now = Date.now();
  const windowMs = settingNum(g.id, "raid_window_seconds", 30) * 1000;
  const youngWindowMs = settingNum(g.id, "raid_young_window_seconds", 60) * 1000;
  const threshold = settingNum(g.id, "raid_join_threshold", 10);
  const youngThreshold = settingNum(g.id, "raid_young_threshold", 5);
  const young = now - member.user.createdTimestamp < 86400000;
  const keep = Math.max(windowMs, youngWindowMs, 10 * 60000);
  const list = (recentJoins.get(g.id) || []).filter((j) => now - j.at < keep);
  list.push({ at: now, id: member.id, young });
  recentJoins.set(g.id, list);
  const inWindow = list.filter((j) => now - j.at < windowMs);
  const youngInWindow = list.filter((j) => j.young && now - j.at < youngWindowMs);
  if (inWindow.length >= Math.max(3, Math.ceil(threshold / 2))) { raidState(g.id).lastBurstAt = now; saveFeatures(); }
  const state = raidState(g.id);
  let reason = null;
  if (threshold && inWindow.length >= threshold) reason = `${inWindow.length} joins in ${windowMs / 1000}s`;
  else if (youngThreshold && youngInWindow.length >= youngThreshold) reason = `${youngInWindow.length} accounts under 24h old joined in ${youngWindowMs / 1000}s`;
  if (state.locked) {
    // Still raiding: push the auto-unlock back and handle the new joiner too
    if (reason) { state.until = now + settingNum(g.id, "raid_lock_minutes", 10) * 60000; saveFeatures(); }
    await timeoutIfYoung(member, "joined during raid mode");
    return;
  }
  if (reason) {
    const joiners = list.filter((j) => now - j.at < Math.max(windowMs, youngWindowMs)).map((j) => j.id);
    await startLockdown(g, reason, null, joiners);
  }
}

async function timeoutIfYoung(member, why) {
  if (!settingOn(member.guild.id, "raid_timeout_young")) return;
  if (Date.now() - member.user.createdTimestamp >= 7 * 86400000) return;
  if (member.moderatable) await member.timeout(3600000, why).catch(() => {});
}

async function raidAlert(guild, payload) {
  const chans = resolveChannels(guild, "raid_alert_channels", []);
  if (!chans.length) return staffAlert(guild, payload);
  for (const ch of chans) if (ch.isTextBased?.()) await ch.send(payload).catch(() => {});
}

export async function startLockdown(guild, reason, byUser = null, joinerIds = []) {
  const state = raidState(guild.id);
  if (state.locked) return false;
  const minutes = settingNum(guild.id, "raid_lock_minutes", 10);
  state.locked = true;
  state.until = Date.now() + minutes * 60000;
  state.slowmodes = {};
  state.prevVerification = null;
  saveFeatures();
  bump(guild.id, "raids");

  // Slow down the configured categories (or every text channel)
  const cats = resolveChannels(guild, "raid_slowmode_categories", []).filter((c) => c.type === ChannelType.GuildCategory).map((c) => c.id);
  for (const ch of guild.channels.cache.values()) {
    if (ch.type !== ChannelType.GuildText) continue;
    if (cats.length && !cats.includes(ch.parentId)) continue;
    if (!ch.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.ManageChannels)) continue;
    state.slowmodes[ch.id] = ch.rateLimitPerUser || 0;
    if ((ch.rateLimitPerUser || 0) < 30) await ch.setRateLimitPerUser(30, "raid mode").catch(() => {});
  }
  // Raise server verification to the highest level
  if (settingOn(guild.id, "raid_set_verification") && guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
    state.prevVerification = guild.verificationLevel;
    await guild.setVerificationLevel(GuildVerificationLevel.VeryHigh, "raid mode").catch(() => { state.prevVerification = null; });
  }
  saveFeatures();
  // Time out the brand-new accounts that joined during the trigger
  let timedOut = 0;
  for (const id of joinerIds) {
    const m = guild.members.cache.get(id) || await guild.members.fetch(id).catch(() => null);
    if (m && Date.now() - m.user.createdTimestamp < 7 * 86400000 && settingOn(guild.id, "raid_timeout_young") && m.moderatable) {
      await m.timeout(3600000, "raid mode").then(() => timedOut++).catch(() => {});
    }
  }
  const pingRoles = resolveRoles(guild, "raid_alert_roles", []);
  const roles = pingRoles.length ? pingRoles : [resolveRole(guild, "staff_role", ["staff", "moderator", "mod"])].filter(Boolean);
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("raid:unlock").setLabel("Unlock now").setStyle(ButtonStyle.Secondary));
  await raidAlert(guild, {
    content: roles.length ? `🔒 Raid mode on ${roles.map((r) => `${r}`).join(" ")}` : "🔒 Raid mode on",
    embeds: [baseEmbed(COLORS.danger).setTitle("🔒 Raid mode on").setDescription(
      `**Trigger:** ${reason}${byUser ? ` (by ${byUser})` : ""}\n\n• Verify button disabled\n• 30s slowmode on ${cats.length ? "selected categories" : "all text channels"}${state.prevVerification !== null ? "\n• Server verification set to Highest" : ""}${timedOut ? `\n• ${timedOut} new account(s) timed out for 1h` : ""}\n\nEnds automatically <t:${Math.floor(state.until / 1000)}:R> with no new trigger, or **Unlock now** / \`!raidmode off\`.`)],
    components: [row],
    allowedMentions: { roles: roles.map((r) => r.id) },
  });
  await logMod(guild, baseEmbed(COLORS.danger).setTitle("🔒 Raid mode started").setDescription(`${reason}${byUser ? ` — by ${byUser}` : ""}`));
  return true;
}

export async function endLockdown(guild, byUser = null) {
  const state = raidState(guild.id);
  if (!state.locked) return false;
  for (const [id, prev] of Object.entries(state.slowmodes || {})) {
    const ch = guild.channels.cache.get(id);
    if (ch) await ch.setRateLimitPerUser(prev, "raid mode ended").catch(() => {});
  }
  if (state.prevVerification !== null && state.prevVerification !== undefined) await guild.setVerificationLevel(state.prevVerification, "raid mode ended").catch(() => {});
  state.locked = false;
  state.until = 0;
  state.slowmodes = {};
  state.prevVerification = null;
  saveFeatures();
  await raidAlert(guild, { embeds: [baseEmbed(COLORS.success).setTitle("🔓 Raid mode off").setDescription(byUser ? `Ended by ${byUser}. Everything restored.` : "Ended automatically. Everything restored.")] });
  await logMod(guild, baseEmbed(COLORS.success).setTitle("🔓 Raid mode ended").setDescription(byUser ? `By ${byUser}` : "Automatic"));
  return true;
}

export async function handleRaidButton(interaction) {
  const s = getSettings(interaction.guildId);
  const ok = s.raid_command_role ? memberAtLeast(interaction.member, "raid_command_role") : isStaff(interaction.member);
  if (!ok) return interaction.reply({ content: "You can't control raid mode.", ephemeral: true });
  const done = await endLockdown(interaction.guild, interaction.user);
  return interaction.reply({ content: done ? "🔓 Raid mode ended." : "Not in raid mode.", ephemeral: true });
}

export async function checkLockdownExpiry(client) {
  for (const guild of client.guilds.cache.values()) {
    const s = featureData(guild.id, "raid", { locked: false });
    if (s.locked && s.until && Date.now() > s.until) await endLockdown(guild);
  }
}

// ======================= ANTI-NUKE =======================
const nukeActions = new Map(); // `${guildId}:${userId}` -> [{ kind, at }]
const DANGEROUS_GRANTS = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles];

// kind: channel | role (delete) | rolecreate | ban | kick | webhook | grant (dangerous permission given to a role)
export async function recordDestructive(guild, executor, kind, detail = null) {
  if (!executor || !settingOn(guild.id, "antinuke_enabled")) return;
  if (executor.id === guild.ownerId || executor.id === guild.client.user.id) return;
  const whitelist = (getSettings(guild.id).antinuke_whitelist || "").split(",").map((s) => s.trim());
  if (whitelist.includes(executor.id)) return;
  const key = `${guild.id}:${executor.id}`;
  const now = Date.now();
  const list = (nukeActions.get(key) || []).filter((a) => now - a.at < 60000);
  list.push({ kind, at: now, detail });
  nukeActions.set(key, list);
  const count = (...kinds) => list.filter((a) => kinds.includes(a.kind)).length;
  const delLimit = settingNum(guild.id, "antinuke_delete_threshold", 3);
  const roleLimit = settingNum(guild.id, "antinuke_role_threshold", 3);
  const banLimit = settingNum(guild.id, "antinuke_ban_threshold", 5);
  const hookLimit = settingNum(guild.id, "antinuke_webhook_threshold", 3);
  const triggered = count("channel") >= delLimit || count("role", "rolecreate") >= roleLimit || count("ban", "kick") >= banLimit
    || count("webhook") >= hookLimit || count("grant") >= 1;
  if (!triggered) return;
  nukeActions.delete(key);

  const member = await guild.members.fetch(executor.id).catch(() => null);
  const stripped = [];
  if (member) {
    for (const role of member.roles.cache.values()) {
      if (role.id === guild.id || !canManageRole(guild, role)) continue;
      if (await member.roles.remove(role, "anti-nuke").then(() => true).catch(() => false)) stripped.push(role.name);
    }
    if (member.moderatable) await member.timeout(28 * 86400000 - 60000, "anti-nuke").catch(() => {});
  }
  // Undo what we can: re-create deleted channels/roles from the last snapshot, revert dangerous grants
  let restored = [];
  if (settingOn(guild.id, "antinuke_restore")) {
    const { restoreDeleted } = await import("./snapshots.js");
    restored = await restoreDeleted(guild, list).catch((e) => [`restore failed: ${e.message}`]);
  }
  const summary = Object.entries(list.reduce((m, a) => ((m[a.kind] = (m[a.kind] || 0) + 1), m), {})).map(([k, n]) => `${n}× ${k}`).join(", ");
  const lead = resolveRoles(guild, "leadership_roles", []);
  const leadFallback = lead.length ? lead : [resolveRole(guild, "leadership_role", ["leadership", "owner", "owners"])].filter(Boolean);
  const ch = resolveChannel(guild, "antinuke_alert_channel", ["admin-chat", "staff-alerts"]);
  const payload = {
    content: leadFallback.length ? leadFallback.map((r) => `${r}`).join(" ") : `<@${guild.ownerId}>`,
    embeds: [baseEmbed(COLORS.danger).setTitle("☢️ ANTI-NUKE TRIGGERED").setDescription(
      `**Who:** ${executor} (${executor.tag}, ${executor.bot ? "bot" : "user"})\n**In the last minute:** ${summary}\n` +
      `**Details:** ${list.map((a) => a.detail).filter(Boolean).slice(0, 10).join(" · ") || "—"}\n\n` +
      (stripped.length ? `**Removed roles:** ${stripped.join(", ")}\n**Timed out:** 28 days` : "⚠️ I couldn't remove their roles (their role is above mine). **Act now.**") +
      (restored.length ? `\n**Restored:** ${restored.join(", ").slice(0, 900)}` : "") +
      "\n\nIf their account was compromised, reset their password/2FA before giving roles back.")],
    allowedMentions: { roles: leadFallback.map((r) => r.id), users: leadFallback.length ? [] : [guild.ownerId] },
  };
  if (ch) await ch.send(payload).catch(() => {}); else await staffAlert(guild, payload);
  await logMod(guild, baseEmbed(COLORS.danger).setTitle("☢️ Anti-nuke").setDescription(`${executor.tag} — ${summary}. Roles stripped: ${stripped.join(", ") || "none"}`));
}

// A role was given Administrator / Manage Server / Manage Roles
export function grantsDanger(oldPerms, newPerms) {
  return DANGEROUS_GRANTS.some((p) => newPerms.has(p, false) && !(oldPerms?.has(p, false)));
}

// ======================= NEW-ACCOUNT REVIEW =======================
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
    new ButtonBuilder().setCustomId(`alt:ok:${member.id}`).setLabel("Approve").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`alt:kick:${member.id}`).setLabel("Kick").setStyle(ButtonStyle.Danger),
  );
  const payload = {
    embeds: [baseEmbed(COLORS.warning).setTitle("🕵️ New account wants to verify").setThumbnail(member.user.displayAvatarURL())
      .setDescription(`${member} (${member.user.tag})\n**Account created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n**Joined:** <t:${Math.floor((member.joinedTimestamp || Date.now()) / 1000)}:R>`)],
    components: [row],
  };
  const reviewCh = resolveChannel(member.guild, "verify_review_channel", ["reports-queue", "staff-alerts"]);
  if (reviewCh) await reviewCh.send(payload).catch(() => {}); else await staffAlert(member.guild, payload);
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
    if (role) await member.roles.add(role, `new account approved by ${interaction.user.tag}`).catch(() => {});
    const unverified = resolveRole(interaction.guild, "unverified_role", ["unverified"]);
    if (unverified) await member.roles.remove(unverified).catch(() => {});
    const { postWelcome, sendWelcomeDm } = await import("./welcome.js");
    if (getSettings(interaction.guildId).welcome_on === "verify") postWelcome(member).catch(() => {});
    sendWelcomeDm(member).catch(() => {});
    await member.send(`✅ You've been verified in **${interaction.guild.name}**.`).catch(() => {});
  } else {
    await member.kick(`new account: kicked by ${interaction.user.tag}`).catch(() => {});
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
  "robiox", "roblox-free", "free-robux", "robux-free", "rbxgift", "roblox-gift", "robloxgift", "grabify", "iplogger", "2no.co", "blasze",
];
const BAIT = /(free\s*(nitro|robux|discord\s*nitro|skins?|vbucks)|nitro\s*(for\s*)?free|airdrop|claim\s*(your|ur)\s*(gift|nitro|reward)|steam\s*gift|nitro\s*gift)/i;
const URL_RE = /https?:\/\/([^\s/<>"]+)[^\s<>"]*/gi;
const linkSeen = new Map(); // `${guildId}:${url}` -> Map(userId -> at)

function suspiciousHost(host) {
  host = host.toLowerCase().replace(/^www\./, "");
  if (LEGIT.has(host) || [...LEGIT].some((d) => host.endsWith("." + d))) return false;
  if (KNOWN_BAD.some((b) => host.includes(b))) return true;
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

async function punish(message, rule, reason, timeoutMs, { strike = false } = {}) {
  bump(message.guild.id, "automodHits");
  bumpMap(message.guild.id, "automodByRule", rule);
  await message.delete().catch(() => {});
  if (timeoutMs && message.member?.moderatable) await message.member.timeout(timeoutMs, reason).catch(() => {});
  await logMod(message.guild, baseEmbed(COLORS.danger).setTitle(`🛡️ AutoMod — ${rule}`).setDescription(
    `**User:** ${message.author} (${message.author.tag})\n**Channel:** <#${message.channelId}>\n**Reason:** ${reason}${timeoutMs ? `\n**Timeout:** ${timeoutMs >= 3600000 ? `${Math.round(timeoutMs / 3600000)} h` : `${Math.round(timeoutMs / 60000)} min`}` : ""}\n\n>>> ${(message.content || "*(attachment)*").slice(0, 900)}`));
  if (strike) await addWarning(message.guild, message.author, message.client.user, `AutoMod: ${rule}`).catch(() => {});
}

// Channels where the spam filters apply: spam_filter_channels + every channel in spam_filter_categories
function inSpamScope(message) {
  const g = message.guild;
  const chans = resolveChannels(g, "spam_filter_channels", ["general", "chat"]).map((c) => c.id);
  const cats = resolveChannels(g, "spam_filter_categories", []).filter((c) => c.type === ChannelType.GuildCategory).map((c) => c.id);
  const parent = message.channel.isThread?.() ? message.channel.parent?.parentId : message.channel.parentId;
  return chans.includes(message.channelId) || (parent && cats.includes(parent));
}

const recentMsgs = new Map(); // `${guildId}:${userId}` -> [{ at, text }]

// Returns true if the message was removed.
export async function runAutoMod(message) {
  if (!message.guild || message.author.bot || !message.member) return false;
  const gid = message.guild.id;
  const staff = isStaff(message.member);
  const text = message.content || "";

  // --- @everyone / @here attempts by people who can't ping everyone ---
  if (/@(everyone|here)/.test(text) && !message.member.permissions.has(PermissionFlagsBits.MentionEveryone) && settingOn(gid, "scam_filter")) {
    const hasLink = URL_RE.test(text); URL_RE.lastIndex = 0;
    if (hasLink) { await punish(message, "everyone ping", "@everyone/@here with a link (common scam)", settingNum(gid, "scam_timeout_minutes", 1440) * 60000); return true; }
  }

  // --- scams ---
  if (settingOn(gid, "scam_filter") && !staff) {
    const urls = [...text.matchAll(URL_RE)].map((m) => ({ url: m[0], host: m[1] }));
    const bad = urls.find((u) => suspiciousHost(u.host));
    if (bad || (urls.length && BAIT.test(text))) {
      await punish(message, "scam link", `Scam/phishing link (${bad?.host || "bait text + link"})`, settingNum(gid, "scam_timeout_minutes", 1440) * 60000);
      await message.author.send(`⚠️ Your message in **${message.guild.name}** was removed because it contained a scam link. Your account may be compromised — change your password and enable 2FA.`).catch(() => {});
      return true;
    }
    // Same link spammed by several accounts → raid mode
    const raidN = settingNum(gid, "scam_link_raid_accounts", 3);
    for (const u of urls) {
      const k = `${gid}:${u.url.toLowerCase()}`;
      const seen = linkSeen.get(k) || new Map();
      for (const [uid, at] of seen) if (Date.now() - at > 5 * 60000) seen.delete(uid);
      seen.set(message.author.id, Date.now());
      linkSeen.set(k, seen);
      if (linkSeen.size > 5000) linkSeen.clear();
      if (raidN && seen.size >= raidN && !raidState(gid).locked) await startLockdown(message.guild, `same link posted by ${seen.size} accounts in 5 min`);
    }
    // QR codes: only checked for newer / low-rank members
    const qrDays = settingNum(gid, "qr_min_account_days", 30);
    const trusted = getSettings(gid).qr_trusted_role ? memberAtLeast(message.member, "qr_trusted_role") : false;
    const newish = Date.now() - message.author.createdTimestamp < qrDays * 86400000;
    if (!trusted && (newish || getSettings(gid).qr_trusted_role)) {
      const images = [...message.attachments.values()].filter((a) => /^image\//.test(a.contentType || "") && a.size < 4_000_000);
      for (const img of images.slice(0, 3)) {
        const qr = await qrInImage(img.url);
        if (qr) {
          await punish(message, "QR code", `QR code image (${qr.slice(0, 80)})`, settingNum(gid, "scam_timeout_minutes", 1440) * 60000);
          await message.author.send(`⚠️ Your image in **${message.guild.name}** was removed: QR codes aren't allowed (they're a common account-stealing scam). Your account may be compromised — change your password and enable 2FA.`).catch(() => {});
          return true;
        }
      }
    }
  }
  if (staff) return false;

  // --- mention spam (everywhere) ---
  const limit = settingNum(gid, "mention_spam_limit", 5);
  if (limit > 0) {
    const unique = new Set(message.mentions.users.filter((u) => u.id !== message.author.id).map((u) => u.id));
    if (unique.size >= limit) {
      await punish(message, "mention spam", `Mention spam (${unique.size} users)`, 10 * 60000, { strike: settingOn(gid, "mention_spam_strike", false) });
      return true;
    }
  }

  if (!inSpamScope(message)) return false;

  // --- flood: rate limit + duplicates ---
  const key = `${gid}:${message.author.id}`;
  const now = Date.now();
  const hist = (recentMsgs.get(key) || []).filter((m) => now - m.at < 60000);
  hist.push({ at: now, text: text.trim().toLowerCase() });
  recentMsgs.set(key, hist);
  if (recentMsgs.size > 10000) recentMsgs.clear();
  const [rateN, rateS] = (getSettings(gid).spam_rate_limit ?? "5/5").split("/").map(Number);
  if (rateN && rateS && hist.filter((m) => now - m.at < rateS * 1000).length >= rateN) {
    await punish(message, "message flood", `${rateN}+ messages in ${rateS}s`, 5 * 60000);
    return true;
  }
  const [dupN, dupS] = (getSettings(gid).spam_duplicate_limit ?? "3/30").split("/").map(Number);
  if (dupN && dupS && text.trim() && hist.filter((m) => now - m.at < dupS * 1000 && m.text === text.trim().toLowerCase()).length >= dupN) {
    await punish(message, "repeated message", `Same message ${dupN}× in ${dupS}s`, 5 * 60000);
    return true;
  }

  // --- zalgo / empty-line walls ---
  const combining = (text.match(/[̀-ͯ҃-҉᷀-᷿⃐-⃿︠-︯]/g) || []).length;
  const emptyLines = (text.match(/\n\s*(?=\n)/g) || []).length;
  if (combining >= 15 || emptyLines >= 4) {
    await punish(message, combining >= 15 ? "zalgo text" : "empty-line spam", "Zalgo / blank-line spam", 0);
    return true;
  }

  // --- caps / emoji (exempt roles allowed) ---
  if (memberHasAny(message.member, "spam_exempt_roles")) return false;
  const letters = text.replace(/[^a-zA-Z]/g, "");
  const caps = letters.replace(/[^A-Z]/g, "").length;
  const emojis = (text.match(/\p{Extended_Pictographic}|<a?:\w+:\d+>/gu) || []).length;
  const capsSpam = text.length > 15 && letters.length >= 10 && caps / letters.length >= 0.7;
  const emojiSpam = emojis >= 10;
  if (capsSpam || emojiSpam) {
    bump(gid, "automodHits");
    bumpMap(gid, "automodByRule", capsSpam ? "caps" : "emoji spam");
    await message.delete().catch(() => {});
    await message.author.send(`Your message in **${message.guild.name}** was removed — please don't spam ${capsSpam ? "caps" : "emojis"}.`).catch(() => {});
    return true;
  }
  return false;
}

// ======================= WARNINGS =======================
// featureData "warnings": { [userId]: [{ id, reason, by, at }] }
export function allWarnings(guildId, userId) {
  return featureData(guildId, "warnings", {})[userId] || [];
}
export function activeWarnings(guildId, userId) {
  const days = settingNum(guildId, "warn_expiry_days", 30);
  return allWarnings(guildId, userId).filter((w) => Date.now() - w.at < days * 86400000);
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
  bumpMap(guild.id, "modActions", `${moderator.id}:warn`);
  const count = activeWarnings(guild.id, target.id).length;
  const step = parseThresholds(guild.id).filter((t) => t.count === count).pop();
  let actionText = "";
  const member = await guild.members.fetch(target.id).catch(() => null);
  if (step && member) {
    const why = `Reached ${count} warnings`;
    if (step.action === "ban" && settingOn(guild.id, "warn_ban_confirm", false)) {
      // Needs an Admin+ to confirm in the mod log
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`wb:ban:${target.id}`).setLabel("Confirm ban").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`wb:skip:${target.id}`).setLabel("Don't ban").setStyle(ButtonStyle.Secondary),
      );
      const { modLogChannel } = await import("./logging.js");
      await modLogChannel(guild)?.send({ embeds: [baseEmbed(COLORS.danger).setTitle("⚖️ Ban confirmation needed").setDescription(`${target} (${target.tag}) reached **${count}** strikes.\nLatest: ${reason || "—"}`)], components: [row] }).catch(() => {});
      actionText = "⏳ Ban pending confirmation";
    } else if (step.action === "ban") { await member.ban({ reason: why }).catch(() => {}); actionText = "🔨 Banned"; bumpMap(guild.id, "modActions", `${moderator.id}:ban`); }
    else if (step.action === "kick") { await member.kick(why).catch(() => {}); actionText = "👢 Kicked"; }
    else if (step.ms) { await member.timeout(Math.min(step.ms, 28 * 86400000), why).catch(() => {}); actionText = `🔇 Timed out for ${step.ms >= 86400000 ? `${step.ms / 86400000}d` : step.ms >= 3600000 ? `${step.ms / 3600000}h` : `${step.ms / 60000}m`}`; bumpMap(guild.id, "modActions", `${moderator.id}:timeout`); }
  }
  await target.send(`⚠️ You were warned in **${guild.name}**: ${reason || "No reason given"}\nYou have **${count}** active warning(s).${actionText ? `\nAction taken: ${actionText}` : ""}`).catch(() => {});
  await logMod(guild, baseEmbed(COLORS.warning).setTitle("⚠️ Warning issued").setDescription(
    `**User:** ${target} (${target.tag})\n**By:** ${moderator}\n**Reason:** ${reason || "none"}\n**Active strikes:** ${count}${actionText ? `\n**Auto-action:** ${actionText}` : ""}\n**Warning ID:** \`${id}\``));
  return { id, count, actionText };
}

export async function handleWarnBanButton(interaction) {
  const s = getSettings(interaction.guildId);
  const ok = s.warn_ban_confirm_role ? memberAtLeast(interaction.member, "warn_ban_confirm_role") : interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers);
  if (!ok) return interaction.reply({ content: "You can't confirm bans.", ephemeral: true });
  const [, action, userId] = interaction.customId.split(":");
  if (action === "ban") {
    await interaction.guild.members.ban(userId, { reason: `Strike limit — confirmed by ${interaction.user.tag}` }).catch(() => {});
    bumpMap(interaction.guildId, "modActions", `${interaction.user.id}:ban`);
  }
  return interaction.update({ content: action === "ban" ? `🔨 Banned <@${userId}> — confirmed by ${interaction.user}` : `Not banned — ${interaction.user}`, components: [] });
}

export function removeWarning(guildId, userId, warnId) {
  const all = featureData(guildId, "warnings", {});
  const uids = userId ? [userId] : Object.keys(all);
  for (const u of uids) {
    const list = all[u] || [];
    const i = list.findIndex((w) => w.id === warnId);
    if (i >= 0) { list.splice(i, 1); saveFeatures(); return u; }
  }
  return null;
}

export function clearWarnings(guildId, userId) {
  const all = featureData(guildId, "warnings", {});
  const n = (all[userId] || []).length;
  delete all[userId];
  saveFeatures();
  return n;
}
