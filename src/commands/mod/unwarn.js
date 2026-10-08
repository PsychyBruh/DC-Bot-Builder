import { baseEmbed, COLORS } from "../utils/embeds.js";
import { removeWarning, clearWarnings } from "../../features/safety.js";
import { memberAllowed } from "../../features/config.js";
import { logMod } from "../../features/logging.js";

export const name = "unwarn";
export const description = "Remove one strike by ID, or all of a member's strikes";
export const usage = "!unwarn <warningId>  |  !unwarn @user all";
export const category = "mod";

export async function execute(message, args) {
  if (!memberAllowed(message.member, null, "unwarn_role")) return message.reply("You can't remove warnings.");
  const target = message.mentions.users.first();
  const which = args.find((a) => !/^<@!?\d+>$/.test(a));
  if (!which) return message.reply(`Usage: \`${usage}\``);
  if (which.toLowerCase() === "all") {
    if (!target) return message.reply("Mention who to clear: `!unwarn @user all`");
    const n = clearWarnings(message.guild.id, target.id);
    await logMod(message.guild, baseEmbed(COLORS.success).setTitle("🧽 Warnings cleared").setDescription(`${target} — ${n} removed by ${message.author}`));
    return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ Cleared ${n} warning(s) from ${target}.`)], allowedMentions: { parse: [] } });
  }
  const uid = removeWarning(message.guild.id, target?.id || null, which);
  if (!uid) return message.reply("No warning with that ID. Check `!warnings @user`.");
  await logMod(message.guild, baseEmbed(COLORS.success).setTitle("🧽 Warning removed").setDescription(`<@${uid}> — \`${which}\` removed by ${message.author}`));
  return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ Removed warning \`${which}\` from <@${uid}>.`)], allowedMentions: { parse: [] } });
}
