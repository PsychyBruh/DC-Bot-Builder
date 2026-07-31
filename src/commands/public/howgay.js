import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "howgay";
export const description = "How gay is someone? (humor)";
export const usage = "!howgay [@user]";
export const category = "fun";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "howgay", "fun"))) return;
  const user = message.mentions.users.first() || message.author;
  const seed = [...user.id].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const pct = seed % 101;
  let bar = "";
  const filled = Math.floor(pct / 10);
  for (let i = 0; i < 10; i++) bar += i < filled ? "🟪" : "⬛";
  const embed = baseEmbed(COLORS.pink)
    .setTitle("🏳️‍🌈 Gay Meter")
    .setDescription(`**${user.username}**\n\n${bar}\n\n**${pct}%** gay`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }));
  await message.reply({ embeds: [embed] });
}
