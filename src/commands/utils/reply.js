import { successEmbed, errorEmbed, infoEmbed, EMOJIS, COLORS } from "./embeds.js";
import { EmbedBuilder } from "discord.js";

export function replyEmbed(message, embed) {
  return message.reply({ embeds: [embed] });
}

export function replyError(message, text) {
  return message.reply({ embeds: [errorEmbed(text)] });
}

export function replySuccess(message, text) {
  return message.reply({ embeds: [successEmbed(text)] });
}

export async function replyThenDelete(message, embed, timeoutMs = 5000) {
  const msg = await message.channel.send({ embeds: [embed] });
  setTimeout(() => msg.delete().catch(() => {}), timeoutMs);
  return msg;
}

export async function ephemeralError(interaction, text) {
  return interaction.reply({ embeds: [errorEmbed(text)], ephemeral: true });
}

export async function ephemeralSuccess(interaction, text) {
  return interaction.reply({ embeds: [successEmbed(text)], ephemeral: true });
}

export async function ephemeralInfo(interaction, title, description, color) {
  const e = infoEmbed(title, description, color || COLORS.info);
  return interaction.reply({ embeds: [e], ephemeral: true });
}
