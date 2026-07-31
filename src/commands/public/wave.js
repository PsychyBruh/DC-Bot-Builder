import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "wave";
export const description = "Wave at someone";
export const usage = "!wave @user";
export const category = "social";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "wave", "fun"))) return;
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Mention someone!")] });
  const embed = baseEmbed(COLORS.info)
    .setTitle("👋 Wave!")
    .setDescription(`**${message.author.username}** waves at **${target.username}**\n\n>>> *waves*`)
    .setThumbnail(target.displayAvatarURL({ dynamic: true }));
  await message.reply({ embeds: [embed] });
}
