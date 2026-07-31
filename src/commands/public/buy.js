import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { ITEMS, ITEM_MAP, addItem } from "../../storage/economy.js";
import { getUser, adjustBalance } from "../../storage/users.js";

export const name = "buy";
export const description = "Buy an item from the shop. !buy <item name>";
export const usage = "!buy <item>";
export const category = "economy";

export async function execute(message, args) {
  const query = args.join(" ").toLowerCase().trim();
  if (!query) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!buy <item>\` (see \`!shop\`)`)] });
  const item = ITEMS.find((i) => i.name.toLowerCase() === query || i.id === query);
  if (!item) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Item not found. See \`!shop\`.`)] });
  const bal = getUser(message.author.id).balance || 0;
  if (bal < item.price) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You need ${EMOJIS.coin} **${item.price.toLocaleString()}** (you have ${bal.toLocaleString()}).`)] });
  adjustBalance(message.author.id, -item.price);
  addItem(message.author.id, item.id);
  const embed = baseEmbed(COLORS.success)
    .setTitle(`${"\u{1F6D2}"} Purchased`)
    .setDescription(`${item.emoji} **${item.name}** \u2014 ${EMOJIS.coin} **${item.price.toLocaleString()}** deducted`)
    .setFooter({ text: `Use \`!inventory\` to view, \`!use ${item.id}\` to activate.` });
  await message.reply({ embeds: [embed] });
}
