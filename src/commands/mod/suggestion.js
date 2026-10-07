import { baseEmbed, COLORS } from "../utils/embeds.js";
import { setSuggestionStatus } from "../../features/voting.js";
import { isStaff } from "../../features/config.js";

export const name = "suggestion";
export const description = "Approve / deny / consider / mark implemented a suggestion";
export const usage = "!suggestion <approve|deny|consider|implemented> <#number> [reason]";
export const category = "mod";

const MAP = { approve: "approved", approved: "approved", deny: "denied", denied: "denied", consider: "considered", considering: "considered", implemented: "implemented", done: "implemented" };

export async function execute(message, args) {
  if (!isStaff(message.member)) return message.reply("Staff only.");
  const status = MAP[(args[0] || "").toLowerCase()];
  if (!status || !args[1]) return message.reply(`Usage: \`${usage}\``);
  const res = await setSuggestionStatus(message.guild, args[1], status, args.slice(2).join(" "), message.author);
  if (res.error) return message.reply(`❌ ${res.error}`);
  return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ Suggestion #${res.number} marked **${status}**.`)] });
}
