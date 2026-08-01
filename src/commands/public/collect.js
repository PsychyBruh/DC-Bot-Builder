import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { PROPERTY_MAP, computePropertyAccrual, PROPERTY_ACCRUAL_CAP_MS } from "../../storage/economy.js";
import { getUser, updateUser, adjustBalance } from "../../storage/users.js";

export const name = "collect";
export const description = "Collect accrued passive income from your property.";
export const usage = "!collect";
export const category = "economy";

export async function execute(message) {
  if (!(await applyCooldown(message, "collect", "economy"))) return;
  const u = getUser(message.author.id);
  if (!u.property || !PROPERTY_MAP[u.property]) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't own any property. See \`!property\`.`)] });
  }
  const { owed, since } = computePropertyAccrual(u);
  const now = Date.now();
  const capped = since >= PROPERTY_ACCRUAL_CAP_MS;

  if (owed <= 0) {
    const prop = PROPERTY_MAP[u.property];
    return message.reply({ embeds: [baseEmbed(COLORS.info).setTitle(`${prop.emoji} Nothing to collect yet`).setDescription(`Your **${prop.name}** earns ${prop.earnRate}/h. Check back later.`)] });
  }

  adjustBalance(message.author.id, owed);
  updateUser(message.author.id, (d) => { d.lastPropertyCollect = now; return d; });
  const prop = PROPERTY_MAP[u.property];
  const hours = (since / 3600000).toFixed(2);
  const embed = baseEmbed(COLORS.success)
    .setTitle(`${prop.emoji} Property income collected`)
    .setDescription(`Collected ${EMOJIS.coin} **${owed.toLocaleString()}** from your **${prop.name}**.\n\nEarned over **${hours}h** at ${prop.earnRate}/h${capped ? ` \u2014 capped at 12h; collect more often to keep accruing` : ""}.`)
    .setFooter({ text: `Rate: ${prop.earnRate.toLocaleString()}/h | Use !collect again any time` });
  await message.reply({ embeds: [embed] });
}
