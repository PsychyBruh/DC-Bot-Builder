import { EmbedBuilder } from "discord.js";
import { getSettings } from "../storage/serverSettings.js";

export const name = "guildMemberRemove";

export async function execute(member) {
  const guild = member.guild;
  const settings = getSettings(guild.id);
  const channel = settings.goodbye_channel
    ? guild.channels.cache.find((c) => c.name === settings.goodbye_channel || c.id === settings.goodbye_channel)
    : null;
  if (!channel || !channel.isTextBased()) return;
  const text = (settings.goodbye_message || "Goodbye {user}!")
    .replace(/{user}/g, member.user?.tag || member.id)
    .replace(/{server}/g, guild.name);
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setDescription(text)
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
}
