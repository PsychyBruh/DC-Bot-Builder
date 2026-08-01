import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { PROPERTY_MAP, rewardCoins } from "../../storage/economy.js";
import { getUser, adjustBalance, updateUser } from "../../storage/users.js";

export const name = "sell-property";
export const description = "Sell your current property back for 50% of price.";
export const usage = "!sell-property";
export const category = "economy";

export async function execute(message) {
  if (!(await applyCooldown(message, "sell-property", "economy"))) return;
  const u = getUser(message.author.id);
  if (!u.property) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't own any property.`)] });
  const prop = PROPERTY_MAP[u.property];
  if (!prop) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Your property is invalid. Contact admin.`)] });
  const refund = Math.floor(prop.price * 0.5);
  // Forbid selling with accrued-but-unclaimed income: pay it out first.
  const { computePropertyAccrual } = await import("../../storage/economy.js");
  const { owed } = computePropertyAccrual(u);
  let owedLine = "";
  if (owed > 0) { const ow = rewardCoins(message.author.id, owed); owedLine = `\n\nAlso paid out ${EMOJIS.coin} **${ow.toLocaleString()}** of uncollected income.${ow !== owed ? `\n**2x coin boost applied!** (base ${owed.toLocaleString()})` : ""}`; }
  const wonRefund = rewardCoins(message.author.id, refund);
  updateUser(message.author.id, (d) => { d.property = null; d.lastPropertyCollect = null; return d; });
  await message.reply({ embeds: [baseEmbed(COLORS.warning).setTitle(`${prop.emoji} Sold Property`).setDescription(`Sold **${prop.name}** back for ${EMOJIS.coin} **${wonRefund.toLocaleString()}**${wonRefund !== refund ? ` (2x boost, base ${refund.toLocaleString()})` : ` (50% of price)`}.${owedLine}`)] });
}
