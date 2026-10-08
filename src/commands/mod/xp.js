import { baseEmbed, COLORS } from "../utils/embeds.js";
import { grantGuildXp, getGuildXp, setGuildXp, applyRankRoles, levelFromXp } from "../../features/levels.js";
import { memberAllowed } from "../../features/config.js";

export const name = "xp";
export const description = "Staff: add, remove or reset a member's server XP";
export const usage = "!xp add @user <amount>  |  !xp remove @user <amount>  |  !xp reset @user";
export const category = "mod";

export async function execute(message, args) {
  if (!memberAllowed(message.member, "xp_admin_roles", null)) return message.reply("Staff only.");
  const sub = (args[0] || "").toLowerCase();
  const target = message.mentions.members.first();
  const amount = parseInt(args.find((a) => /^\d+$/.test(a)), 10);
  if (!target || !["add", "remove", "reset"].includes(sub) || (sub !== "reset" && !(amount > 0))) return message.reply(`Usage: \`${usage}\``);
  if (sub === "reset") {
    setGuildXp(message.guild.id, target.id, 0);
    await applyRankRoles(target, 0);
  } else {
    await grantGuildXp(message.guild, target, sub === "add" ? amount : -amount, message.channel);
  }
  const xp = getGuildXp(message.guild.id, target.id);
  return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ ${target} now has **${xp.toLocaleString()} XP** (level ${levelFromXp(xp)}).`)], allowedMentions: { parse: [] } });
}
