import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { registerRoom } from "../../storage/privateRooms.js";

export const name = "priv";
export const description = "Create a private text channel for you and mentioned users";
export const usage = "!priv @user1 @user2 ...";
export const category = "rooms";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "priv", "heavy"))) return;
  const users = [...message.mentions.users.values()].filter((u) => !u.bot);
  if (users.length === 0) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Mention at least one user")] });
  }
  let cat = message.guild.channels.cache.find((c) => c.name === "🔒 Private Groups" && c.type === ChannelType.GuildCategory);
  if (!cat) {
    cat = await message.guild.channels.create({
      name: "🔒 Private Groups",
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: message.guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] },
      ],
    });
  }
  const overwrites = [
    { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
    { id: message.guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels] },
  ];
  for (const u of users) {
    overwrites.push({ id: u.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
  }
  const room = await message.guild.channels.create({
    name: `Private - ${users.map((u) => u.username).slice(0, 3).join(", ")}`.slice(0, 90),
    type: ChannelType.GuildText,
    parent: cat.id,
    permissionOverwrites: overwrites,
  });
  registerRoom({ id: room.id, ownerId: message.author.id, guildId: message.guild.id, type: "text" });
  await message.reply({ embeds: [baseEmbed(COLORS.success)
    .setTitle("🔒 Private Group Created")
    .setDescription(`Room: <#${room.id}>\n\nMembers: ${users.map((u) => `<@${u.id}>`).join(", ")}`)
  ] });
}
