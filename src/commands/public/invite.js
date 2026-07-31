import { baseEmbed, COLORS } from "../utils/embeds.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { getAllRooms } from "../../storage/privateRooms.js";

function findUserRoom(guildId, userId) {
  return getAllRooms().find((r) => r.guildId === guildId && r.ownerId === userId);
}

export const name = "invite";
export const description = "Add a user to your private room";
export const usage = "!invite @user";
export const category = "rooms";

export async function execute(message) {
  const room = findUserRoom(message.guild.id, message.author.id);
  if (!room) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ You don't have a private room. Use `!solo` first.")] });
  }
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Mention a user")] });
  const ch = await message.guild.channels.fetch(room.id).catch(() => null);
  if (!ch) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Room not found")] });
  await ch.permissionOverwrites.edit(target.id, {
    ViewChannel: true,
    SendMessages: true,
    Connect: true,
    Speak: true,
  });
  await message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ ${target} added to your room`)] });
}
