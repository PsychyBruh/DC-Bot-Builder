import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "howsus";
export const description = "How sus is someone?";
export const usage = "!howsus [@user]";
export const category = "fun";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "howsus", "fun"))) return;
  const user = message.mentions.users.first() || message.author;
  const seed = [...user.id].reduce((acc, c) => acc + c.charCodeAt(0) + 21, 0);
  const pct = seed % 101;
  let bar = "";
  const filled = Math.floor(pct / 10);
  for (let i = 0; i < 10; i++) bar += i < filled ? "🟥" : "⬛";
  const embed = baseEmbed(COLORS.danger)
    .setTitle("🚨 Sus Meter")
    .setDescription(`**${user.username}**\n\n${bar}\n\n**${pct}%** sus`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }));
  await message.reply({ embeds: [embed] });
}
