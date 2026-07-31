import { baseEmbed, COLORS } from "../utils/embeds.js";
import { getAllRooms, removeRoom } from "../../storage/privateRooms.js";

function findUserRoom(guildId, userId) {
  return getAllRooms().find((r) => r.guildId === guildId && r.ownerId === userId);
}

export const name = "leave";
export const description = "Delete your private room";
export const usage = "!leave";
export const category = "rooms";

export async function execute(message) {
  const room = findUserRoom(message.guild.id, message.author.id);
  if (!room) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ You don't have a private room")] });
  }
  const ch = await message.guild.channels.fetch(room.id).catch(() => null);
  if (ch) await ch.delete("owner left private room").catch(() => {});
  removeRoom(room.id);
  await message.reply({ embeds: [baseEmbed(COLORS.success).setDescription("✅ Private room deleted")] });
}
