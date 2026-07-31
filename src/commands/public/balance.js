import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getUser } from "../../storage/users.js";
import { JOBS, PROPERTY_MAP } from "../../storage/economy.js";
import { getPrice } from "../../storage/market.js";

export const name = "balance";
export const description = "Check your wallet, job, shares, and property";
export const usage = "!balance [@user]";
export const category = "economy";

export async function execute(message) {
  const target = message.mentions.users.first() || message.author;
  const u = getUser(target.id);
  const shares = u.shares || 0;
  const shareValue = Math.floor(shares * getPrice());
  const job = u.job ? JOBS.find((j) => j.id === u.job) : null;
  const prop = u.property ? PROPERTY_MAP[u.property] : null;
  const netWorth = (u.balance || 0) + shareValue + (prop ? prop.price : 0);

  const lines = [`${EMOJIS.coin} **Wallet:** ${(u.balance || 0).toLocaleString()} coins`];
  if (job) lines.push(`${job.emoji} **Job:** ${job.name} (${EMOJIS.coin} ${job.base}/shift)`);
  if (shares > 0) lines.push(`${EMOJIS.chart} **Shares:** ${shares.toFixed(4)} NOVA \u2014 value ${EMOJIS.coin} ${shareValue.toLocaleString()}`);
  if (prop) lines.push(`${prop.emoji} **Property:** ${prop.name} (${EMOJIS.coin} ${prop.income}/shift)`);
  if ((u.karma || 0) > 0) lines.push(`${EMOJIS.heart} **Karma:** ${u.karma}`);
  if (u.jailed && u.jailed.until > Date.now()) lines.push(`${"\u{1F6AB}"} **Jailed** until ${new Date(u.jailed.until).toLocaleTimeString()}`);

  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${EMOJIS.money} Balance \u2014 ${target.username}`)
    .setDescription(lines.join("\n"))
    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `Net worth: ${EMOJIS.coin} ${netWorth.toLocaleString()}` });
  await message.reply({ embeds: [embed] });
}
