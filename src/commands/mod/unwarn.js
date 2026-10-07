import { baseEmbed, COLORS } from "../utils/embeds.js";
import { removeWarning, clearWarnings } from "../../features/safety.js";
import { isStaff } from "../../features/config.js";
import { logMod } from "../../features/logging.js";

export const name = "unwarn";
export const description = "Remove one strike by ID, or all of a member's strikes";
export const usage = "!unwarn @user <warningId>  |  !unwarn @user all";
export const category = "mod";

export async function execute(message, args) {
  if (!isStaff(message.member)) return message.reply("Only staff can remove warnings.");
  const target = message.mentions.users.first();
  const which = args.find((a) => !/^<@!?\d+>$/.test(a));
  if (!target || !which) return message.reply(`Usage: \`${usage}\``);
  if (which.toLowerCase() === "all") {
    const n = clearWarnings(message.guild.id, target.id);
    await logMod(message.guild, baseEmbed(COLORS.success).setTitle("🧽 Warnings cleared").setDescription(`${target} — ${n} removed by ${message.author}`));
    return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ Cleared ${n} warning(s) from ${target}.`)], allowedMentions: { parse: [] } });
  }
  if (!removeWarning(message.guild.id, target.id, which)) return message.reply("No warning with that ID. Check `!warnings @user`.");
  await logMod(message.guild, baseEmbed(COLORS.success).setTitle("🧽 Warning removed").setDescription(`${target} — \`${which}\` removed by ${message.author}`));
  return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ Removed warning \`${which}\` from ${target}.`)], allowedMentions: { parse: [] } });
}
