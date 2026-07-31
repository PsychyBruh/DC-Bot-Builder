import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "handsome";
export const description = "How handsome is someone?";
export const usage = "!handsome [@user]";
export const category = "fun";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "handsome", "fun"))) return;
  const user = message.mentions.users.first() || message.author;
  const seed = [...user.id].reduce((acc, c) => acc + c.charCodeAt(0) + 13, 0);
  const pct = seed % 101;
  let bar = "";
  const filled = Math.floor(pct / 10);
  for (let i = 0; i < 10; i++) bar += i < filled ? "🟨" : "⬛";
  const embed = baseEmbed(COLORS.gold)
    .setTitle("😎 Handsome Meter")
    .setDescription(`**${user.username}**\n\n${bar}\n\n**${pct}%** handsome`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }));
  await message.reply({ embeds: [embed] });
}
