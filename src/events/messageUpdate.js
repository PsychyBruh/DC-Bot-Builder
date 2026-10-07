import { getSettings } from "../storage/serverSettings.js";
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
  const settings = getSettings(guild.id);
  const channel = settings.log_channel
    ? guild.channels.cache.find((c) => c.name === settings.log_channel || c.id === settings.log_channel)
    : null;
  if (!channel || !channel.isTextBased()) return;
  const before = oldMessage.partial ? "*(not cached)*" : oldMessage.content || "*(empty)*";
  const embed = baseEmbed(0xFEE75C)
    .setTitle("✏️ Message Edited")
    .setDescription(`**Author:** ${newMessage.author.tag}\n**Channel:** <#${newMessage.channelId}>\n\n**Before:** ${before}\n**After:** ${newMessage.content || "*(empty)*"}`);
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
}
