import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "avatar";
export const description = "Get a user's avatar";
export const usage = "!avatar [@user]";
export const category = "utility";

export async function execute(message) {
  const user = message.mentions.users.first() || message.author;
  const avatar = user.displayAvatarURL({ dynamic: true, size: 1024 });
  const embed = baseEmbed(COLORS.purple)
    .setTitle(`🖼️ ${user.username}'s Avatar`)
    .setImage(avatar);
  await message.reply({ embeds: [embed] });
}
