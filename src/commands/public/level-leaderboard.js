import { baseEmbed, COLORS } from "../utils/embeds.js";
import { guildLeaderboard } from "../../features/levels.js";

export const name = "level-leaderboard";
export const description = "Top 10 by level/XP in this server";
export const usage = "!level-leaderboard";
export const category = "social";

export async function execute(message) {
  const list = guildLeaderboard(message.guild.id, 10);
  if (!list.length) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("No data yet.")] });
  const medals = ["🥇", "🥈", "🥉"];
  const lines = list.map((u, i) => {
    const lvl = u.level;
    const xp = u.xp.toLocaleString();
    return `${medals[i] || `**${i + 1}.**`} <@${u.id}> — Level **${lvl}** (${xp} XP)`;
  });
  const embed = baseEmbed(COLORS.purple)
    .setTitle("⭐ Level Leaderboard")
    .setDescription(lines.join("\n"))
    .setFooter({ text: "Earn XP by chatting" });
  await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}
