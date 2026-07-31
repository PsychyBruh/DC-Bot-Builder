import { EmbedBuilder } from "discord.js";
import { getSettings } from "../storage/serverSettings.js";

export const name = "messageDelete";

export async function execute(message) {
  if (message.author?.bot) return;
  if (message.partial) {
    try { await message.fetch(); } catch { return; }
  }
  const guild = message.guild;
  if (!guild) return;
  const settings = getSettings(guild.id);
  const channel = settings.log_channel
    ? guild.channels.cache.find((c) => c.name === settings.log_channel || c.id === settings.log_channel)
    : null;
  if (!channel || !channel.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle("🗑️ Message Deleted")
    .setDescription(`**Author:** ${message.author.tag}\n**Channel:** <#${message.channelId}>\n**Content:** ${message.content || "*(no content)*"}`.slice(0, 1024))
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
}
