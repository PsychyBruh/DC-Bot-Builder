import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "hug";
export const description = "Hug someone";
export const usage = "!hug @user";
export const category = "social";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "hug", "fun"))) return;
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Mention someone!")] });
  if (target.id === message.author.id) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("❌ Find someone else to hug")] });
  const embed = baseEmbed(COLORS.pink)
    .setTitle("🫂 Hug!")
    .setDescription(`**${message.author.username}** hugs **${target.username}**\n\n>>> *warm hug*`)
    .setThumbnail(target.displayAvatarURL({ dynamic: true }));
  await message.reply({ embeds: [embed] });
}
