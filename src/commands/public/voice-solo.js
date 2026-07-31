import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { registerRoom, getAllRooms, removeRoom } from "../../storage/privateRooms.js";

async function getOrCreateCategory(guild, name) {
  let cat = guild.channels.cache.find((c) => c.name === name && c.type === ChannelType.GuildCategory);
  if (!cat) {
    cat = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] },
      ],
    });
  }
  return cat;
}

function findUserRoom(guildId, userId) {
  return getAllRooms().find((r) => r.guildId === guildId && r.ownerId === userId);
}

export const name = "voice-solo";
export const description = "Create a private voice channel just for you";
export const usage = "!voice-solo [name]";
export const category = "rooms";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "voice-solo", "heavy"))) return;
  const existing = findUserRoom(message.guild.id, message.author.id);
  if (existing) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ You already have a private room: <#${existing.id}>`)] });
  }
  const cat = await getOrCreateCategory(message.guild, "🎮 Private Rooms");
  const name = args.join(" ").trim() || `${message.author.username}'s VC`;
  const room = await message.guild.channels.create({
    name: name.slice(0, 90),
    type: ChannelType.GuildVoice,
    parent: cat.id,
    permissionOverwrites: [
      { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
      { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers] },
      { id: message.guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels] },
    ],
  });
  registerRoom({ id: room.id, ownerId: message.author.id, guildId: message.guild.id, type: "voice" });
  await message.reply({ embeds: [baseEmbed(COLORS.success)
    .setTitle("🔒 Private Voice Channel")
    .setDescription(`Join: <#${room.id}>\n\nAuto-deletes 30 seconds after everyone leaves.`)
  ] });
}

export const name2 = "leave";
export { findUserRoom, removeRoom };
