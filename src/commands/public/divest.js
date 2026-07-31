import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance, updateUser } from "../../storage/users.js";
import { getPrice } from "../../storage/market.js";

export const name = "divest";
export const description = "Sell NOVA shares. !divest <shares>";
export const usage = "!divest <shares>";
export const category = "economy";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "divest", "economy"))) return;
  const shares = parseFloat(args[0]);
  if (!shares || shares <= 0) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!divest <shares>\``)] });
  const u = getUser(message.author.id);
  if ((u.shares || 0) < shares) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You only have ${(u.shares || 0).toFixed(4)} shares.`)] });

  const price = getPrice();
  const proceeds = Math.floor(shares * price);
  const avgCost = u.shareCost || price;
  const fee = Math.floor(proceeds * 0.02); // 2% transaction fee
  const net = proceeds - fee;
  adjustBalance(message.author.id, net);
  updateUser(message.author.id, (d) => {
    d.shares = +((d.shares || 0) - shares).toFixed(4);
    if (d.shares <= 0) d.shareCost = 0;
    return d;
  });
  const profit = net - Math.floor(shares * avgCost);

  const embed = baseEmbed(profit >= 0 ? COLORS.success : COLORS.danger)
    .setTitle(`${"\u{1F4C9}"} Shares Sold`)
    .setDescription(`Sold **${shares}** NOVA shares at ${EMOJIS.coin} **${price.toFixed(2)}**/share.\n\nProceeds: ${EMOJIS.coin} **${proceeds.toLocaleString()}**\nFee (2%): ${EMOJIS.coin} **${fee.toLocaleString()}**\nNet: ${EMOJIS.coin} **${net.toLocaleString()}**\n\n${profit >= 0 ? EMOJIS.coin : EMOJIS.cross} ${profit >= 0 ? "Profit" : "Loss"}: **${Math.abs(profit).toLocaleString()}** ${profit >= 0 ? "gained" : "lost"} (avg cost ${avgCost.toFixed(2)})`)
    .setFooter({ text: "Use !portfolio to see remaining holdings" });
  await message.reply({ embeds: [embed] });
}
