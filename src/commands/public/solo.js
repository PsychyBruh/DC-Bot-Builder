import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { registerRoom, getAllRooms } from "../../storage/privateRooms.js";

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

export const name = "solo";
export const description = "Create a private text channel just for you";
export const usage = "!solo [name]";
export const category = "rooms";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "solo", "heavy"))) return;
  const existing = findUserRoom(message.guild.id, message.author.id);
  if (existing) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ You already have a private room: <#${existing.id}>`)] });
  }
  const cat = await getOrCreateCategory(message.guild, "🎮 Private Rooms");
  const name = args.join(" ").trim() || `${message.author.username}'s room`;
  const room = await message.guild.channels.create({
    name: name.slice(0, 90),
    type: ChannelType.GuildText,
    parent: cat.id,
    permissionOverwrites: [
      { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
      { id: message.guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels] },
    ],
  });
  registerRoom({ id: room.id, ownerId: message.author.id, guildId: message.guild.id, type: "text" });
  const embed = baseEmbed(COLORS.success)
    .setTitle("🔒 Private Room Created")
    .setDescription(`Your private room: <#${room.id}>\n\nAuto-deletes after 10 minutes of inactivity.\nUse \`!leave\` to delete it now.`);
  await message.reply({ embeds: [embed] });
  await room.send({ embeds: [baseEmbed(COLORS.purple).setDescription(`👋 Welcome to your private room!\n\nThis channel is invisible to other members. Use it however you want.\n\nType \`!leave\` to delete.`)] });
}
