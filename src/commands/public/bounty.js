import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance } from "../../storage/users.js";
import { placeBounty, totalBounty, getBounty } from "../../storage/bounties.js";

export const name = "bounty";
export const description = "Place or view bounties on a user. !bounty @user <amount>";
export const usage = "!bounty @user <amount>";
export const category = "economy";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "bounty", "economy"))) return;
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!bounty @user <amount>\` (or \`!bounty @user\` to view)`)] });
  if (target.id === message.author.id) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Can't put a bounty on yourself.`)] });

  const amount = parseInt(args.find((a) => /^\d+$/.test(a)), 10) || 0;
  const existing = totalBounty(target.id);

  if (amount >= 1) {
    const bal = getUser(message.author.id).balance || 0;
    if (bal < amount) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You need ${EMOJIS.coin} **${amount.toLocaleString()}** (you have ${bal.toLocaleString()}).`)] });
    adjustBalance(message.author.id, -amount);
    const total = placeBounty(message.author.id, target.id, amount);
    const embed = baseEmbed(COLORS.danger)
      .setTitle(`${"\u{1F3AF}"} Bounty Placed`)
      .setDescription(`${EMOJIS.coin} **${amount.toLocaleString()}** posted on **${target.username}**.\n\nTotal bounty on ${target.username}: ${EMOJIS.coin} **${total.toLocaleString()}**`)
      .setFooter({ text: "The next person to !steal from them successfully will collect it." });
    return message.reply({ embeds: [embed] });
  }

  // view existing bounties
  const list = getBounty(target.id);
  if (!list.length) return message.reply({ embeds: [baseEmbed(COLORS.info).setDescription(`No bounty on **${target.username}**.`)] });
  const lines = list.map((b) => `<@${b.from}>: ${EMOJIS.coin} ${b.amount.toLocaleString()}`);
  return message.reply({ embeds: [baseEmbed(COLORS.danger).setTitle(`Bounty on ${target.username} \u2014 ${EMOJIS.coin} ${existing.toLocaleString()}`).setDescription(lines.join("\n"))] });
}
