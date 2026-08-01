import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { ITEMS, removeItem, rewardCoins } from "../../storage/economy.js";
import { getUser } from "../../storage/users.js";

export const name = "sell";
export const description = "Sell an item for 50% of its price. !sell <item>";
export const usage = "!sell <item>";
export const category = "economy";

export async function execute(message, args) {
  const query = args.join(" ").toLowerCase().trim();
  if (!query) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!sell <item>\` (see \`!inventory\`)`)] });
  const item = ITEMS.find((i) => i.name.toLowerCase() === query || i.id === query);
  if (!item) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Unknown item.`)] });
  const u = getUser(message.author.id);
  if (!u.inventory?.[item.id]) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't own **${item.name}**.`)] });
  removeItem(message.author.id, item.id, 1);
  const won = rewardCoins(message.author.id, item.sell);
  return message.reply({ embeds: [baseEmbed(COLORS.success).setTitle(`${"\u{1F9FE}"} Sold`).setDescription(`${item.emoji} **${item.name}** for ${EMOJIS.coin} **${won.toLocaleString()}**${won !== item.sell ? ` (2x boost, base ${item.sell.toLocaleString()})` : ` (50% of price)`}.`)] });
}
