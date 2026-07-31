import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "highfive";
export const description = "High-five someone";
export const usage = "!highfive @user";
export const category = "social";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "highfive", "fun"))) return;
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Mention someone!")] });
  const embed = baseEmbed(COLORS.gold)
    .setTitle("✋ High Five!")
    .setDescription(`**${message.author.username}** high-fives **${target.username}**\n\n>>> *slap!*`)
    .setThumbnail(target.displayAvatarURL({ dynamic: true }));
  await message.reply({ embeds: [embed] });
}
