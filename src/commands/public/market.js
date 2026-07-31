import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getPrice, getHistory } from "../../storage/market.js";

export const name = "market";
export const description = "View the NOVA share price and recent history.";
export const usage = "!market";
export const category = "economy";

export async function execute(message) {
  const price = getPrice();
  const history = getHistory();
  const lines = history.slice(-10).map((h, i) => {
    const prev = history[i - 1]?.price || h.price;
    const diff = h.price - prev;
    const arrow = diff > 0 ? "\u{1F4C8}" : diff < 0 ? "\u{1F4C9}" : "\u{1F80B}";
    return `${arrow} ${EMOJIS.coin} **${h.price.toFixed(2)}**`;
  });
  const embed = baseEmbed(COLORS.purple)
    .setTitle(`${"\u{1F4C8}"} NOVA Market`)
    .setDescription(`Current price: ${EMOJIS.coin} **${price.toFixed(2)}**/share\n\n**Recent trends:**\n${lines.slice(-10).join("\n") || "No history yet"}`)
    .setFooter({ text: `Use !invest <amount> to buy, !divest <shares> to sell` });
  await message.reply({ embeds: [embed] });
}
