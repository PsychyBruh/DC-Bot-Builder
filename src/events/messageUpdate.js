import { logMessage } from "../features/logging.js";
import { baseEmbed } from "../commands/utils/embeds.js";

export const name = "messageUpdate";

export async function execute(oldMessage, newMessage) {
  if (newMessage.partial) {
    try { await newMessage.fetch(); } catch { return; }
  }
  if (newMessage.author?.bot) return;
  if (!oldMessage.partial && oldMessage.content === newMessage.content) return;
  const guild = newMessage.guild;
  if (!guild) return;
  const before = oldMessage.partial ? "*(not cached)*" : oldMessage.content || "*(empty)*";
  const embed = baseEmbed(0xFEE75C)
    .setTitle("✏️ Message Edited")
    .setDescription(`**Author:** ${newMessage.author.tag}\n**Channel:** <#${newMessage.channelId}>\n\n**Before:** ${before}\n**After:** ${newMessage.content || "*(empty)*"}`);
  await logMessage(guild, embed);
}
