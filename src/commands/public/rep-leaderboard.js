import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getTopUsers } from "../../storage/users.js";

export const name = "rep-leaderboard";
export const description = "Top reputation";
export const usage = "!rep-leaderboard";
export const category = "leaderboard";

export async function execute(message) {
  const top = getTopUsers("rep.total", 10);
  if (top.length === 0) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("No data yet")] });
  const lines = await Promise.all(top.map(async (u, i) => {
    let name = "Unknown";
    try { const user = await message.client.users.fetch(u.id); name = user.username; } catch {}
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**${i + 1}.**`;
    return `${medal} **${name}** — ${EMOJIS.trophy} ${(u.rep?.total || 0)}`;
  }));
  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${EMOJIS.trophy} Most Reputable`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: "Top 10" });
  await message.reply({ embeds: [embed] });
}
