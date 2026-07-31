import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "slap";
export const description = "Slap someone";
export const usage = "!slap @user";
export const category = "social";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "slap", "fun"))) return;
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Mention someone!")] });
  if (target.id === message.author.id) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("❌ Self-harm is not the move")] });
  const embed = baseEmbed(COLORS.danger)
    .setTitle("🖐️ Slap!")
    .setDescription(`**${message.author.username}** slaps **${target.username}**\n\n>>> *SLAP*`)
    .setThumbnail(target.displayAvatarURL({ dynamic: true }));
  await message.reply({ embeds: [embed] });
}
