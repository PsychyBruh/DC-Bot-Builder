import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { registerRoom, getAllRooms } from "../../storage/privateRooms.js";

function findUserRoom(guildId, userId) {
  return getAllRooms().find((r) => r.guildId === guildId && r.ownerId === userId);
}

export const name = "study";
export const description = "Create a private focus room with auto-mute/deafen";
export const usage = "!study";
export const category = "rooms";

export async function execute(message) {
  if (!(await applyCooldown(message, "study", "heavy"))) return;
  const existing = findUserRoom(message.guild.id, message.author.id);
  if (existing) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ You already have a room: <#${existing.id}>`)] });
  }
  let cat = message.guild.channels.cache.find((c) => c.name === "📚 Focus" && c.type === ChannelType.GuildCategory);
  if (!cat) {
    cat = await message.guild.channels.create({
      name: "📚 Focus",
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: message.guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers] },
      ],
    });
  }
  const room = await message.guild.channels.create({
    name: `${message.author.username}'s focus`,
    type: ChannelType.GuildVoice,
    parent: cat.id,
    permissionOverwrites: [
      { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
      { id: message.guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ManageChannels] },
    ],
  });
  registerRoom({ id: room.id, ownerId: message.author.id, guildId: message.guild.id, type: "voice" });
  await message.reply({ embeds: [baseEmbed(COLORS.success)
    .setTitle("📚 Focus Mode")
    .setDescription(`Focus room created: <#${room.id}>\n\nYou'll be auto-muted/deafened when you join. Use \`!leave\` to exit.`)
  ] });
}
