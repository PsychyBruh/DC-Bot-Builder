import { baseEmbed, COLORS } from "../utils/embeds.js";
import { allWarnings } from "../../features/safety.js";
import { isStaff, settingNum } from "../../features/config.js";

export const name = "warnings";
export const description = "See your strikes (staff can check anyone), active and expired";
export const usage = "!warnings [@user]";
export const category = "mod";

export async function execute(message) {
  const mentioned = message.mentions.users.first();
  if (mentioned && mentioned.id !== message.author.id && !isStaff(message.member)) return message.reply("You can only check your own warnings.");
  const target = mentioned || message.author;
  const days = settingNum(message.guild.id, "warn_expiry_days", 30);
  const all = allWarnings(message.guild.id, target.id).slice().sort((a, b) => b.at - a.at);
  const active = all.filter((w) => Date.now() - w.at < days * 86400000);
  const expired = all.filter((w) => Date.now() - w.at >= days * 86400000);
  const line = (w, on) => `\`${w.id}\` • <t:${Math.floor(w.at / 1000)}:d> • ${w.reason} — <@${w.by}>${on ? ` · expires <t:${Math.floor((w.at + days * 86400000) / 1000)}:R>` : ""}`;
  const embed = baseEmbed(active.length ? COLORS.warning : COLORS.success).setTitle(`⚠️ ${target.username}'s warnings`)
    .addFields(
      { name: `Active (${active.length})`, value: active.map((w) => line(w, true)).join("\n").slice(0, 1024) || "None 🎉" },
      { name: `Expired (${expired.length})`, value: expired.slice(0, 10).map((w) => line(w, false)).join("\n").slice(0, 1024) || "None" },
    )
    .setFooter({ text: `Strikes expire after ${days} days` });
  return message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}
