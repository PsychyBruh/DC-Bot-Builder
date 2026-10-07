import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { featureData, saveFeatures, resolveChannel, canManageRole } from "./config.js";
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
  const gained = [];
  for (const r of cfg.list) {
    const role = member.guild.roles.cache.get(r.roleId);
    if (!role || !canManageRole(member.guild, role)) continue;
    const has = member.roles.cache.has(role.id);
    if (want.has(role.id) && !has) { await member.roles.add(role, `rank: level ${r.level}`).catch(() => {}); gained.push(r); }
    else if (!want.has(role.id) && has) await member.roles.remove(role, "rank changed").catch(() => {});
  }
  return gained;
}

// Called from the XP handler for every message that earns XP.
export async function addGuildXp(message, amount) {
  const guild = message.guild;
  const settings = getSettings(guild.id);
  if (settings.levels_enabled === "false") return;
  const noXp = (settings.no_xp_channels || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (noXp.includes(message.channelId) || noXp.includes(message.channel.name)) return;
  const rate = Math.min(5, Math.max(0, parseFloat(settings.xp_rate) || 1));
  const xp = featureData(guild.id, "xp", {});
  const before = xp[message.author.id] || 0;
  xp[message.author.id] = before + Math.round(amount * rate);
  saveFeatures();
  const oldLevel = levelFromXp(before);
  const newLevel = levelFromXp(xp[message.author.id]);
  if (newLevel <= oldLevel) return;

  const member = message.member || await guild.members.fetch(message.author.id).catch(() => null);
  const gained = member ? await applyRankRoles(member, newLevel) : [];
  let coinLine = "";
  for (const r of gained) if (r.coins) { adjustBalance(message.author.id, r.coins); coinLine += `\n🪙 +${r.coins.toLocaleString()} coins`; }

  if (settings.levelup_announce === "false") return;
  const channel = resolveChannel(guild, "rank_up_channel", ["rank-ups", "rankups", "level-ups", "levelups"]) || message.channel;
  const rankLine = gained.length ? `\n\n🏅 New rank: ${gained.map((r) => `<@&${r.roleId}>${r.perk ? ` — ${r.perk}` : ""}`).join(", ")}` : "";
  const text = (settings.levelup_message || "{user} reached **level {level}**!")
    .replace(/{user}/g, `<@${message.author.id}>`)
    .replace(/{level}/g, String(newLevel));
  await channel.send({
    embeds: [baseEmbed(gained.length ? COLORS.gold : COLORS.purple).setTitle(gained.length ? "🏅 Rank Up!" : "🎉 Level Up!").setDescription(`${text}${rankLine}${coinLine}`).setThumbnail(message.author.displayAvatarURL())],
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

export function guildLeaderboard(guildId, limit = 10) {
  return Object.entries(featureData(guildId, "xp", {}))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, x]) => ({ id, xp: x, level: levelFromXp(x) }));
}
