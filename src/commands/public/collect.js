import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { PROPERTY_MAP, computePropertyAccrual, PROPERTY_ACCRUAL_CAP_MS, rewardCoins } from "../../storage/economy.js";
import { getUser, updateUser } from "../../storage/users.js";

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

  const won = rewardCoins(message.author.id, owed);
  updateUser(message.author.id, (d) => { d.lastPropertyCollect = now; return d; });
  try { const { progressQuest } = await import("../../storage/quests.js"); const c = progressQuest(message.author.id, "collect"); if (c) { rewardCoins(message.author.id, c.reward); await message.channel.send({ embeds: [baseEmbed(COLORS.success).setTitle(`\u{1F4DC} Quest Complete!`).setDescription(`\`collect ${c.target}x\` done! ${EMOJIS.coin} **${c.reward.toLocaleString()}** reward credited.`)] }).catch(() => {}); } } catch {}
  const prop = PROPERTY_MAP[u.property];
  const hours = (since / 3600000).toFixed(2);
  const embed = baseEmbed(COLORS.success)
    .setTitle(`${prop.emoji} Property income collected`)
    .setDescription(`Collected ${EMOJIS.coin} **${won.toLocaleString()}** from your **${prop.name}**.${won !== owed ? `\n**2x coin boost applied!** (base ${owed.toLocaleString()})` : ""}\n\nEarned over **${hours}h** at ${prop.earnRate}/h${capped ? ` \u2014 capped at 12h; collect more often to keep accruing` : ""}.`)
    .setFooter({ text: `Rate: ${prop.earnRate.toLocaleString()}/h | Use !collect again any time` });
  await message.reply({ embeds: [embed] });
}
