import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "howsmart";
export const description = "How smart is someone?";
export const usage = "!howsmart [@user]";
export const category = "fun";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "howsmart", "fun"))) return;
  const user = message.mentions.users.first() || message.author;
  const seed = [...user.id].reduce((acc, c) => acc + c.charCodeAt(0) + 7, 0);
  const pct = seed % 101;
  let bar = "";
  const filled = Math.floor(pct / 10);
  for (let i = 0; i < 10; i++) bar += i < filled ? "🟦" : "⬛";
  const embed = baseEmbed(COLORS.info)
    .setTitle("🧠 Smart Meter")
    .setDescription(`**${user.username}**\n\n${bar}\n\n**${pct}%** smart`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }));
  await message.reply({ embeds: [embed] });
}
