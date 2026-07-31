import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance } from "../../storage/users.js";

export const name = "rent";
export const description = "Manually collect rent from a tenant (low-balance user).";
export const usage = "!rent @user <amount>";
export const category = "economy";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "rent", "social"))) return;
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!rent @user <amount>\``)] });
  if (target.id === message.author.id) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Can't collect rent from yourself.`)] });
  if (target.bot) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Can't collect rent from bots.`)] });
  const u = getUser(message.author.id);
  if (!u.property) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't own any property to collect rent from.`)] });
  const amount = parseInt(args.find((a) => /^\d+$/.test(a)), 10) || 0;
  if (amount < 1) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Specify a positive amount.`)] });
  const targetBal = getUser(target.id).balance || 0;
  if (targetBal < amount) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} ${target.username} only has ${targetBal.toLocaleString()} coins.`)] });
  adjustBalance(target.id, -amount);
  adjustBalance(message.author.id, amount);
  const embed = baseEmbed(COLORS.success)
    .setTitle(`${"\u{1F4B9}"} Rent Collected`)
    .setDescription(`Collected ${EMOJIS.coin} **${amount.toLocaleString()}** from **${target.username}**.`)
    .setFooter({ text: "Properties are not tied to users passively; rent is manual extortion." });
  await message.reply({ embeds: [embed] });
}
