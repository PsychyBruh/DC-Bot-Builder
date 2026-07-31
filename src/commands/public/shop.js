import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { ITEMS } from "../../storage/economy.js";

export const name = "shop";
export const description = "Browse items for sale (boosters, consumables, collectibles)";
export const usage = "!shop";
export const category = "economy";

export async function execute(message) {
  const lines = ITEMS.map((i) => `${i.emoji} **${i.name}** \u2014 ${EMOJIS.coin} **${i.price.toLocaleString()}**\n> _${i.desc}_`);
  const embed = baseEmbed(COLORS.purple)
    .setTitle(`${"\u{1F6D2}"} Shop`)
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: `Use !buy <item name> to purchase. Sellback value: 50% of price.` });
  await message.reply({ embeds: [embed] });
}
