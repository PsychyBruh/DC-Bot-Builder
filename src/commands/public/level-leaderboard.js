import { baseEmbed, COLORS } from "../utils/embeds.js";
import { getTopUsers } from "../../storage/users.js";

export const name = "level-leaderboard";
export const description = "Top 10 by level/XP";
export const usage = "!level-leaderboard";
export const category = "social";

export async function execute(message) {
  const list = getTopUsers("xp", 10);
  if (!list.length) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("No data yet.")] });
  const medals = ["🥇", "🥈", "🥉"];
  const lines = list.map((u, i) => {
    const lvl = u.level || 0;
    const xp = u.xp || 0;
    return `${medals[i] || `**${i + 1}.**`} <@${u.id}> — Level **${lvl}** (${xp} XP)`;
  });
  const embed = baseEmbed(COLORS.purple)
    .setTitle("⭐ Level Leaderboard")
    .setDescription(lines.join("\n"))
    .setFooter({ text: "Earn XP by chatting" });
  await message.reply({ embeds: [embed] });
}
