import { EmbedBuilder } from "discord.js";
import { getSettings } from "../storage/serverSettings.js";

export const name = "messageUpdate";

export async function execute(oldMessage, newMessage) {
  if (oldMessage.author?.bot) return;
  if (oldMessage.partial) {
    try { await oldMessage.fetch(); } catch { return; }
  }
  if (oldMessage.content === newMessage.content) return;
  const guild = oldMessage.guild;
  if (!guild) return;
  const settings = getSettings(guild.id);
  const channel = settings.log_channel
    ? guild.channels.cache.find((c) => c.name === settings.log_channel || c.id === settings.log_channel)
    : null;
  if (!channel || !channel.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle("✏️ Message Edited")
    .setDescription(`**Author:** ${oldMessage.author.tag}\n**Channel:** <#${oldMessage.channelId}>\n\n**Before:** ${oldMessage.content || "*(empty)*"}\n**After:** ${newMessage.content || "*(empty)*"}`.slice(0, 1024))
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
}
