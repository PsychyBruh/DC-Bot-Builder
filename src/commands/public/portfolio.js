import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getUser, getBalance } from "../../storage/users.js";
import { getPrice, getHistory } from "../../storage/market.js";

export const name = "portfolio";
export const description = "View your investments and current value.";
export const usage = "!portfolio";
export const category = "economy";

export async function execute(message) {
  const u = getUser(message.author.id);
  const held = u.shares || 0;
  const price = getPrice();
  const value = Math.floor(held * price);
  const invested = Math.floor(held * (u.shareCost || price));
  const profit = value - invested;
  const history = getHistory();
  const trend = history.length >= 2 ? history[history.length - 1].price - history[history.length - 2].price : 0;

  const embed = baseEmbed(COLORS.purple)
    .setTitle(`${EMOJIS.chart} Portfolio \u2014 ${message.author.username}`)
    .setDescription(`**${held.toFixed(4)} NOVA shares** @ avg ${EMOJIS.coin} ${(u.shareCost || 0).toFixed(2)}\n\nCurrent price: ${EMOJIS.coin} **${price.toFixed(2)}** ${trend > 0 ? "\u{1F4C8}" : trend < 0 ? "\u{1F4C9}" : "\u2014"}\nCurrent value: ${EMOJIS.coin} **${value.toLocaleString()}**\nUnrealized ${profit >= 0 ? "gain" : "loss"}: ${profit >= 0 ? EMOJIS.coin : EMOJIS.cross} **${Math.abs(profit).toLocaleString()}**`)
    .setFooter({ text: `Bank: ${EMOJIS.coin} ${(u.balance||0).toLocaleString()} | Total worth: ${EMOJIS.coin} ${((u.balance||0)+value).toLocaleString()}` });
  await message.reply({ embeds: [embed] });
}
