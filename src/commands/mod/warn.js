import { baseEmbed, COLORS } from "../utils/embeds.js";
import { addWarning } from "../../features/safety.js";
import { isStaff } from "../../features/config.js";

export const name = "warn";
export const description = "Give a member a strike (auto-timeout/ban at the configured thresholds)";
export const usage = "!warn @user <reason>";
export const category = "mod";

export async function execute(message, args) {
  if (!isStaff(message.member)) return message.reply("Only staff can warn members.");
  const target = message.mentions.members.first();
  if (!target) return message.reply(`Usage: \`${usage}\``);
  if (target.user.bot || target.id === message.author.id) return message.reply("You can't warn that user.");
  if (isStaff(target) && message.member.roles.highest.position <= target.roles.highest.position) return message.reply("You can't warn someone at or above your role.");
  const reason = args.filter((a) => !/^<@!?\d+>$/.test(a)).join(" ").trim() || "No reason given";
  const { id, count, actionText } = await addWarning(message.guild, target.user, message.author, reason);
  return message.reply({ embeds: [baseEmbed(COLORS.warning).setTitle("⚠️ Warned").setDescription(
    `${target} now has **${count}** active strike(s).\n**Reason:** ${reason}${actionText ? `\n**Auto-action:** ${actionText}` : ""}\n*ID \`${id}\`*`)], allowedMentions: { parse: [] } });
}
