import { baseEmbed, COLORS } from "../utils/embeds.js";
import { getAllRooms } from "../../storage/privateRooms.js";

function findUserRoom(guildId, userId) {
  return getAllRooms().find((r) => r.guildId === guildId && r.ownerId === userId);
}

export const name = "kick";
export const description = "Remove a user from your private room";
export const usage = "!kick @user";
export const category = "rooms";

export async function execute(message) {
  const room = findUserRoom(message.guild.id, message.author.id);
  if (!room) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ No room")] });
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Mention a user")] });
  const ch = await message.guild.channels.fetch(room.id).catch(() => null);
  if (!ch) return;
  await ch.permissionOverwrites.delete(target.id).catch(() => {});
  await message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ ${target} removed`)] });
}
