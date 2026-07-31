import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getUser } from "../../storage/users.js";

export const name = "reputation";
export const description = "Check reputation";
export const usage = "!reputation [@user]";
export const category = "social";

export async function execute(message, args) {
  const target = message.mentions.users.first() || message.author;
  const user = getUser(target.id);
  const total = user.rep.total || 0;
  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${EMOJIS.trophy} Reputation`)
    .setDescription(`**${target.username}** has **${total}** rep ${EMOJIS.trophy}`)
    .setThumbnail(target.displayAvatarURL({ dynamic: true }));
  await message.reply({ embeds: [embed] });
}
