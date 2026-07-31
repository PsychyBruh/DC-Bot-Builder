import { baseEmbed, COLORS } from "../utils/embeds.js";
import { getUser } from "../../storage/users.js";

export const name = "balance";
export const description = "Check your coin balance";
export const usage = "!balance [@user]";
export const category = "economy";

export async function execute(message) {
  const target = message.mentions.users.first() || message.author;
  const balance = getUser(target.id).balance || 0;
  const embed = baseEmbed(COLORS.gold)
    .setTitle("💰 Balance")
    .setDescription(`**${target.username}** has **${balance.toLocaleString()}** coins`)
    .setThumbnail(target.displayAvatarURL({ dynamic: true }));
  await message.reply({ embeds: [embed] });
}
