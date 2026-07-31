import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, updateUser, adjustBalance } from "../../storage/users.js";

export const name = "give";
export const description = "Gift coins to another user (free up to 1000/day per receiver).";
export const usage = "!give @user <amount>";
export const category = "economy";

const FREE_DAILY = 1000;
const TAX = 0.10; // 10% tax above free quota

export async function execute(message, args) {
  if (!(await applyCooldown(message, "give", "social"))) return;
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!give @user <amount>\``)] });
  if (target.id === message.author.id) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Can't give to yourself.`)] });
  if (target.bot) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Can't give to bots.`)] });
  const amount = parseInt(args.find((a) => /^\d+$/.test(a)), 10) || 0;
  if (amount < 1) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Specify a positive amount.`)] });

  const today = new Date().toISOString().slice(0, 10);
  const u = getUser(message.author.id);
  const key = `${target.id}`;
  const dateKey = `${target.id}_date`;
  if (u.giveUsed?.[dateKey] !== today) {
    u.giveUsed = u.giveUsed || {};
    u.giveUsed[key] = 0;
    u.giveUsed[dateKey] = today;
  }
  const usedToday = u.giveUsed[key] || 0;
  const freeRemaining = Math.max(0, FREE_DAILY - usedToday);
  const taxed = Math.max(0, amount - freeRemaining);
  const tax = Math.floor(taxed * TAX);
  const total = amount; // what the giver pays
  const actual = amount - tax; // what the receiver gets
  const bal = u.balance || 0;
  if (bal < total) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't have ${total.toLocaleString()} (balance: ${bal.toLocaleString()}).`)] });

  // Apply transfers (use adjustBalance: deducts from giver, credits receiver, tracks stats)
  adjustBalance(message.author.id, -total);
  adjustBalance(target.id, actual);
  updateUser(message.author.id, (d) => {
    d.giveUsed = d.giveUsed || {};
    d.giveUsed[key] = (d.giveUsed[key] || 0) + amount;
    d.giveUsed[dateKey] = today;
    return d;
  });

  const remaining = Math.max(0, FREE_DAILY - (usedToday + amount));
  const embed = baseEmbed(COLORS.success)
    .setTitle(`${"\u{1F381}"} Coins sent`)
    .setDescription(`Sent ${EMOJIS.coin} **${actual.toLocaleString()}** to **${target.username}**.${tax ? `\n${EMOJIS.warn} Tax (10% above ${FREE_DAILY}c/day free): ${EMOJIS.coin} **${tax.toLocaleString()}**` : ""}`)
    .setFooter({ text: `Free daily allowance remaining to ${target.username}: ${remaining}c / ${FREE_DAILY}c` });
  await message.reply({ embeds: [embed] });
}
