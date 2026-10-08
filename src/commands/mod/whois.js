import { baseEmbed, COLORS } from "../utils/embeds.js";
import { isStaff } from "../../features/config.js";
import { getLink } from "../../features/roblox.js";

export const name = "whois";
export const description = "Staff: show a member's linked Roblox account";
export const usage = "!whois @user";
export const category = "mod";

export async function execute(message) {
  if (!isStaff(message.member)) return message.reply("Staff only.");
  const target = message.mentions.users.first();
  if (!target) return message.reply(`Usage: \`${usage}\``);
  const link = getLink(target.id);
  if (!link) return message.reply({ content: `${target} hasn't linked a Roblox account.`, allowedMentions: { parse: [] } });
  return message.reply({ embeds: [baseEmbed(COLORS.dark).setTitle(`🔗 ${target.username}`)
    .setDescription(`**Roblox:** [${link.username}](https://www.roblox.com/users/${link.robloxId}/profile)\n**User ID:** ${link.robloxId}\n**Linked:** <t:${Math.floor(link.linkedAt / 1000)}:R>`)], allowedMentions: { parse: [] } });
}
