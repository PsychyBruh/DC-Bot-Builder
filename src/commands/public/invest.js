import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance, updateUser } from "../../storage/users.js";
import { getPrice } from "../../storage/market.js";

export const name = "invest";
export const description = "Buy NOVA shares with coins. !invest <amount>";
export const usage = "!invest <amount>";
export const category = "economy";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "invest", "economy"))) return;
  const amount = parseInt(args[0], 10) || 0;
  if (amount < 1) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!invest <amount>\``)] });
  const bal = getUser(message.author.id).balance || 0;
  if (bal < amount) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't have ${EMOJIS.coin} **${amount.toLocaleString()}**.`)] });

  const price = getPrice();
  const shares = +(amount / price).toFixed(4);
  adjustBalance(message.author.id, -amount);
  updateUser(message.author.id, (u) => {
    const totalCost = (u.shareCost || 0) * (u.shares || 0) + amount;
    u.shares = (u.shares || 0) + shares;
    u.shareCost = totalCost / u.shares;
    return u;
  });

  const embed = baseEmbed(COLORS.success)
    .setTitle(`${"\u{1F4C8}"} Shares Purchased`)
    .setDescription(`Bought **${shares}** NOVA shares at ${EMOJIS.coin} **${price.toFixed(2)}**/share.\n\nSpent: ${EMOJIS.coin} **${amount.toLocaleString()}**`)
    .setFooter({ text: `Use !portfolio to view holdings, !divest <shares> to sell` });
  await message.reply({ embeds: [embed] });
}
