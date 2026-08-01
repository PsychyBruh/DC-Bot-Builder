import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getUser } from "../../storage/users.js";

export const name = "wallet";
export const description = "See someone's wallet (coin balance only). Optional @user.";
export const usage = "!wallet [@user]";
export const category = "economy";

export async function execute(message) {
  const target = message.mentions.users.first() || message.author;
  const u = getUser(target.id);
  const bal = u.balance || 0;
  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${EMOJIS.money} Wallet \u2014 ${target.username}`)
    .setDescription(`${EMOJIS.coin} **${bal.toLocaleString()}** coins`)
    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: "Use !balance for full breakdown (job, shares, property, net worth)" });
  await message.reply({ embeds: [embed] });
}
