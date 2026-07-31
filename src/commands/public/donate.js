import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance, updateUser } from "../../storage/users.js";

export const name = "donate";
export const description = "Donate coins to someone poorer than you (gain karma).";
export const usage = "!donate @user <amount>";
export const category = "economy";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "donate", "social"))) return;
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!donate @user <amount>\``)] });
  if (target.id === message.author.id) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Can't donate to yourself.`)] });
  if (target.bot) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Bots have no use for coins.`)] });
  const amount = parseInt(args.find((a) => /^\d+$/.test(a)), 10) || 0;
  if (amount < 1) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Specify a positive amount.`)] });
  const me = getUser(message.author.id);
  const them = getUser(target.id);
  if (me.balance < amount) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't have ${amount.toLocaleString()} (balance: ${me.balance.toLocaleString()}).`)] });
  if (them.balance >= me.balance) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} ${target.username} is not poorer than you. Use \`!give\` instead.`)] });

  adjustBalance(message.author.id, -amount);
  adjustBalance(target.id, amount);
  const karmaGain = Math.max(1, Math.floor(amount / 100));
  updateUser(message.author.id, (u) => { u.karma = (u.karma || 0) + karmaGain; return u; });
  const embed = baseEmbed(COLORS.success)
    .setTitle(`${EMOJIS.heart} Donated`)
    .setDescription(`Sent ${EMOJIS.coin} **${amount.toLocaleString()}** to **${target.username}**.\n\n${EMOJIS.star} Gained **${karmaGain}** karma`)
    .setFooter({ text: `Karma: ${getUser(message.author.id).karma}` });
  await message.reply({ embeds: [embed] });
}
