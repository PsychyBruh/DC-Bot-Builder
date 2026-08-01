import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance, userExists } from "../../storage/users.js";

export const name = "tip";
export const description = "Send a small tip (5-50c) to a helpful user.";
export const usage = "!tip @user";
export const category = "economy";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "tip", "social"))) return;
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!tip @user\``)] });
  if (target.id === message.author.id) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Can't tip yourself.`)] });
  if (target.bot) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Bots can't receive tips.`)] });
  if (message.guild && !message.guild.members.cache.has(target.id)) {
    try { await message.guild.members.fetch(target.id); } catch {
      return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} ${target.username} isn't in this server.`)] });
    }
  }
  if (!userExists(target.id)) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} ${target.username} hasn't used the bot's economy yet.`)] });
  }
  const bal = getUser(message.author.id).balance || 0;
  const amount = Math.floor(Math.random() * 46) + 5; // 5-50
  if (bal < amount) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't have ${EMOJIS.coin} **${amount}** to tip.`)] });
  adjustBalance(message.author.id, -amount);
  adjustBalance(target.id, amount);
  const embed = baseEmbed(COLORS.pink)
    .setTitle(`${EMOJIS.heart} Tip`)
    .setDescription(`${message.author.username} tipped **${target.username}** ${EMOJIS.coin} **${amount}**!`)
    .setFooter({ text: "Tip amounts are random between 5 and 50" });
  await message.reply({ embeds: [embed] });
}
