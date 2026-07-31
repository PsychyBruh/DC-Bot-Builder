import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "banner";
export const description = "Get a user's banner";
export const usage = "!banner [@user]";
export const category = "utility";

export async function execute(message) {
  const user = message.mentions.users.first() || message.author;
  const fetched = await message.client.users.fetch(user.id, { force: true }).catch(() => null);
  const banner = fetched?.bannerURL?.({ size: 1024 });
  if (!banner) {
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("No banner set")] });
  }
  const embed = baseEmbed(COLORS.purple)
    .setTitle(`🖼️ ${user.username}'s Banner`)
    .setImage(banner);
  await message.reply({ embeds: [embed] });
}
