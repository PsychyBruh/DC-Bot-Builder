import { baseEmbed, COLORS } from "../utils/embeds.js";
import { getGuildXp, levelFromXp, xpForLevel, getRankConfig, guildLeaderboard } from "../../features/levels.js";

export const name = "level";
export const description = "Check your level and XP in this server";
export const usage = "!level [@user]";
export const category = "social";

export async function execute(message) {
  const target = message.mentions.users.first() || message.author;
  const xp = getGuildXp(message.guild.id, target.id);
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const needed = xpForLevel(level + 1) - floor;
  const into = xp - floor;
  const pct = Math.min(100, Math.round((into / needed) * 100));
  const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
  const ranks = getRankConfig(message.guild.id).list;
  const current = [...ranks].reverse().find((r) => r.level <= level);
  const next = ranks.find((r) => r.level > level);
  const position = guildLeaderboard(message.guild.id, 100000).findIndex((u) => u.id === target.id) + 1;
  const embed = baseEmbed(COLORS.purple)
    .setTitle(`⭐ ${target.username}'s Level`)
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "Level", value: `${level}`, inline: true },
      { name: "XP", value: `${into.toLocaleString()} / ${needed.toLocaleString()}`, inline: true },
      { name: "Server rank", value: position ? `#${position}` : "—", inline: true },
      { name: "Progress", value: `\`${bar}\` ${pct}%`, inline: false },
    );
  if (ranks.length) {
    embed.addFields(
      { name: "Current rank", value: current ? `<@&${current.roleId}>` : "None yet", inline: true },
      { name: "Next rank", value: next ? `<@&${next.roleId}> at level ${next.level}` : "Max rank!", inline: true },
    );
  }
  embed.setFooter({ text: "Earn XP by chatting in this server" });
  await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}
