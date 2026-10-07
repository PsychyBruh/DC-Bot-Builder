import { baseEmbed, COLORS } from "../utils/embeds.js";
import { activeWarnings } from "../../features/safety.js";
import { isStaff, settingNum } from "../../features/config.js";

export const name = "warnings";
export const description = "See your strikes (staff can check anyone)";
export const usage = "!warnings [@user]";
export const category = "mod";

export async function execute(message) {
  const mentioned = message.mentions.users.first();
  if (mentioned && mentioned.id !== message.author.id && !isStaff(message.member)) return message.reply("You can only check your own warnings.");
  const target = mentioned || message.author;
  const list = activeWarnings(message.guild.id, target.id);
  const days = settingNum(message.guild.id, "warn_expiry_days", 30);
  const embed = baseEmbed(list.length ? COLORS.warning : COLORS.success)
    .setTitle(`⚠️ ${target.username}'s warnings`)
    .setDescription(list.length
      ? list.map((w) => `\`${w.id}\` • <t:${Math.floor(w.at / 1000)}:d> • ${w.reason} — <@${w.by}>\n  expires <t:${Math.floor((w.at + days * 86400000) / 1000)}:R>`).join("\n").slice(0, 4000)
      : "No active warnings. 🎉")
    .setFooter({ text: `${list.length} active • strikes expire after ${days} days` });
  return message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}
