import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { featureData, saveFeatures, resolveChannel, resolveRole, canManageRole } from "./config.js";
import { getSettings } from "../storage/serverSettings.js";
import { adjustBalance } from "../storage/users.js";

// Per-server XP (separate from the global economy level) so ranks in one server
// aren't earned by chatting in another.
// featureData "xp":    { [userId]: totalXp }
// featureData "ranks": { list: [{ level, roleId, perk?, coins? }], stack: false }

// Total XP needed to reach `level` (MEE6-style curve: gets steadily harder)
export function xpForLevel(level) {
  let total = 0;
  for (let l = 0; l < level; l++) total += 5 * l * l + 50 * l + 100;
  return total;
}
export function levelFromXp(xp) {
  let level = 0;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function getGuildXp(guildId, userId) {
  return featureData(guildId, "xp", {})[userId] || 0;
}

export function getRankConfig(guildId) {
  const cfg = featureData(guildId, "ranks", { list: [], stack: false });
  cfg.list.sort((a, b) => a.level - b.level);
  return cfg;
}

export function setRankRole(guildId, level, roleId, extra = {}) {
  const cfg = getRankConfig(guildId);
  cfg.list = cfg.list.filter((r) => r.level !== level && r.roleId !== roleId);
  cfg.list.push({ level, roleId, ...extra });
  cfg.list.sort((a, b) => a.level - b.level);
  saveFeatures();
}

export function removeRankRole(guildId, level) {
  const cfg = getRankConfig(guildId);
  const before = cfg.list.length;
  cfg.list = cfg.list.filter((r) => r.level !== level);
  saveFeatures();
  return before !== cfg.list.length;
}

// Give the member the rank role(s) their level qualifies for.
export async function applyRankRoles(member, level) {
  const cfg = getRankConfig(member.guild.id);
  if (!cfg.list.length) return [];
  const earned = cfg.list.filter((r) => r.level <= level);
  const top = earned[earned.length - 1];
  const want = new Set(cfg.stack ? earned.map((r) => r.roleId) : top ? [top.roleId] : []);
  const verifiedId = resolveRole(member.guild, "verify_role", ["verified", "member"])?.id;
  const gained = [];
  for (const r of cfg.list) {
    const role = member.guild.roles.cache.get(r.roleId);
    if (!role || !canManageRole(member.guild, role)) continue;
    const has = member.roles.cache.has(role.id);
    if (want.has(role.id) && !has) { await member.roles.add(role, `rank: level ${r.level}`).catch(() => {}); gained.push(r); }
    // Never take away the verified/member role, even if it's also the lowest rank (it unlocks the server)
    else if (!want.has(role.id) && has && role.id !== verifiedId) await member.roles.remove(role, "rank changed").catch(() => {});
  }
  return gained;
}

const lastGuildXp = new Map(); // `${guildId}:${userId}` -> timestamp

// Called for every message. Applies the per-server cooldown, amount range and multipliers.
export async function addGuildXp(message, _globalAmount, itemMultiplier = 1) {
  const guild = message.guild;
  const settings = getSettings(guild.id);
  if (settings.levels_enabled === "false") return;
  if ((message.content || "").length < 2 && !message.attachments.size) return;
  const noXp = (settings.no_xp_channels || "").split(",").map((s) => s.trim()).filter(Boolean);
  const chName = message.channel.name || "";
  if (noXp.some((n) => n === message.channelId || n === message.channel.parentId || chName === n || chName.replace(/[^a-z0-9-]/gi, "").endsWith(n.replace(/[^a-z0-9-]/gi, "")))) return;
  const key = `${guild.id}:${message.author.id}`;
  const cooldown = Math.max(0, parseFloat(settings.xp_cooldown_seconds) || 60) * 1000;
  if (Date.now() - (lastGuildXp.get(key) || 0) < cooldown) return;
  lastGuildXp.set(key, Date.now());
  if (lastGuildXp.size > 20000) lastGuildXp.clear();
  const min = Math.max(0, parseInt(settings.xp_min, 10) || 15);
  const max = Math.max(min, parseInt(settings.xp_max, 10) || 25);
  let amount = min + Math.floor(Math.random() * (max - min + 1));
  const rate = Math.min(5, Math.max(0, parseFloat(settings.xp_rate) || 1));
  const boosterMult = message.member?.premiumSince ? Math.max(1, parseFloat(settings.xp_booster_multiplier) || 1) : 1;
  amount = Math.round(amount * rate * boosterMult * itemMultiplier);
  await grantGuildXp(guild, message.member || await guild.members.fetch(message.author.id).catch(() => null), amount, message.channel);
}

// Shared by chat XP, voice XP and !xp add/remove. `fallbackChannel` is used if there's no rank-up channel.
export async function grantGuildXp(guild, member, amount, fallbackChannel = null) {
  if (!member) return;
  const settings = getSettings(guild.id);
  const xp = featureData(guild.id, "xp", {});
  const before = xp[member.id] || 0;
  xp[member.id] = Math.max(0, before + amount);
  saveFeatures();
  if (amount > 0) { const { bumpMap } = await import("./stats.js"); bumpMap(guild.id, "xpGained", member.id, amount); }
  const oldLevel = levelFromXp(before);
  const newLevel = levelFromXp(xp[member.id]);
  if (newLevel === oldLevel) return;
  if (newLevel < oldLevel) { await applyRankRoles(member, newLevel); return; }
  const message = { author: member.user, member, channel: fallbackChannel };
  const gained = member ? await applyRankRoles(member, newLevel) : [];
  let coinLine = "";
  for (const r of gained) if (r.coins) { adjustBalance(message.author.id, r.coins); coinLine += `\n🪙 +${r.coins.toLocaleString()} coins`; }

  if (settings.levelup_announce === "false") return;
  const channel = resolveChannel(guild, "rank_up_channel", ["rank-ups", "rankups", "level-ups", "levelups"]) || message.channel;
  if (!channel) return;
  const top = gained[gained.length - 1];
  const topRole = top ? guild.roles.cache.get(top.roleId) : null;
  let text;
  if (topRole) {
    text = (settings.rank_up_message || "{user} is now a {rank}.")
      .replace(/{user}/g, `<@${message.author.id}>`).replace(/{rank}/g, `**${topRole.name}**`).replace(/{level}/g, String(newLevel));
    if (top.perk) text += `\n*${top.perk}*`;
  } else {
    // Ranks are configured: only announce actual rank changes, not every level
    if (getRankConfig(guild.id).list.length && settings.levelup_every_level !== "true") return;
    text = (settings.levelup_message || "{user} reached **level {level}**!")
      .replace(/{user}/g, `<@${message.author.id}>`).replace(/{level}/g, String(newLevel));
  }
  await channel.send({
    embeds: [baseEmbed(topRole?.color || COLORS.dark).setDescription(`${text}${coinLine}`).setThumbnail(message.author.displayAvatarURL())],
    allowedMentions: { users: [message.author.id] },
  }).catch(() => {});
}

// Re-apply rank roles to everyone (after changing the rank list).
export async function syncRanks(guild) {
  const xp = featureData(guild.id, "xp", {});
  const members = await guild.members.fetch().catch(() => guild.members.cache);
  let changed = 0;
  for (const m of members.values()) {
    if (m.user.bot) continue;
    const gained = await applyRankRoles(m, levelFromXp(xp[m.id] || 0));
    changed += gained.length;
  }
  return changed;
}

// Voice XP: every 5 minutes, members in a voice channel with 2+ non-AFK, non-bot, non-deafened people.
export async function runVoiceXp(client) {
  for (const guild of client.guilds.cache.values()) {
    const amount = parseFloat(getSettings(guild.id).voice_xp);
    if (!amount || getSettings(guild.id).levels_enabled === "false") continue;
    for (const ch of guild.channels.cache.values()) {
      if (!ch.isVoiceBased?.() || ch.id === guild.afkChannelId) continue;
      const active = ch.members.filter((m) => !m.user.bot && !m.voice.selfDeaf && !m.voice.serverDeaf);
      if (active.size < 2) continue;
      for (const m of active.values()) {
        const mult = m.premiumSince ? Math.max(1, parseFloat(getSettings(guild.id).xp_booster_multiplier) || 1) : 1;
        await grantGuildXp(guild, m, Math.round(amount * mult), null);
      }
    }
  }
}

export function setGuildXp(guildId, userId, value) {
  featureData(guildId, "xp", {})[userId] = Math.max(0, Math.round(value));
  saveFeatures();
}

export function guildLeaderboard(guildId, limit = 10) {
  return Object.entries(featureData(guildId, "xp", {}))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, x]) => ({ id, xp: x, level: levelFromXp(x) }));
}
