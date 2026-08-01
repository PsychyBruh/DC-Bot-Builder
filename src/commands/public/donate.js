import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance, updateUser } from "../../storage/users.js";
import { rewardCoins, addItem, KARMA_MILESTONES } from "../../storage/economy.js";

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

  // One-time milestone rewards (coins + free Golden Trophy at the top tiers)
  let milestoneLine = "";
  const newKarma = getUser(message.author.id).karma;
  for (const m of KARMA_MILESTONES) {
    if (newKarma >= m.at && !(getUser(message.author.id).karmaMilestones || []).includes(m.at)) {
      updateUser(message.author.id, (u) => {
        u.karmaMilestones = u.karmaMilestones || [];
        u.karmaMilestones.push(m.at);
        return u;
      });
      const won = rewardCoins(message.author.id, m.reward);
      let extra = "";
      if (m.trophy) { addItem(message.author.id, "trophy", 1); extra = `\n${"\u{1F3C6}"} You also earned a **Golden Trophy** \u2014 use it to unlock a Golden Aura!`; }
      milestoneLine += `\n\n${"\u{1F4DC}"} **Karma Milestone ${m.at}!**\n${EMOJIS.coin} **${won.toLocaleString()}** bonus${extra}`;
    }
  }

  const embed = baseEmbed(COLORS.success)
    .setTitle(`${EMOJIS.heart} Donated`)
    .setDescription(`Sent ${EMOJIS.coin} **${amount.toLocaleString()}** to **${target.username}**.\n\n${EMOJIS.star} Gained **${karmaGain}** karma${milestoneLine}`)
    .setFooter({ text: `Karma: ${newKarma} | +1% luck & +1% work wages per karma (max +50%) | Milestones at 10/25/50/100/250/500/1000` });
  await message.reply({ embeds: [embed] });
}
