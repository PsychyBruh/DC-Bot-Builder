import { ChannelType, PermissionFlagsBits } from "discord.js";

const KEY_PERMS = ["ADMINISTRATOR", "MANAGE_ROLES", "MANAGE_CHANNELS", "KICK_MEMBERS", "BAN_MEMBERS", "MODERATE_MEMBERS", "MENTION_EVERYONE"];

const TYPE_SHORT = {
  [ChannelType.GuildText]: "t",
  [ChannelType.GuildVoice]: "v",
  [ChannelType.GuildAnnouncement]: "a",
  [ChannelType.GuildForum]: "f",
  [ChannelType.GuildStageVoice]: "s",
};

function hasPerm(bitfield, permName) {
  const flag = PermissionFlagsBits[permName];
  return flag ? (bitfield & flag) === flag : false;
}

export async function analyzeGuild(guild) {
  await guild.fetch();
  const everyoneRole = guild.roles.everyone;
  const everyoneBit = everyoneRole.permissions.bitfield;

  const roles = guild.roles.cache
    .filter((r) => r.name !== "@everyone")
    .map((role) => ({
      n: role.name,
      c: role.hexColor === "#000000" ? undefined : role.hexColor,
      k: KEY_PERMS.filter((p) => hasPerm(role.permissions.bitfield, p)),
      p: role.permissions.bitfield.toString(),
      m: role.members.size,
    }));

  const channels = [];

  for (const [, channel] of guild.channels.cache) {
    const entry = { n: channel.name, pos: channel.position };
    if (channel.type === ChannelType.GuildCategory) {
      entry.c = true;
    } else {
      const short = TYPE_SHORT[channel.type];
      if (short) entry.t = short;
      if (channel.parentId) entry.p = guild.channels.cache.get(channel.parentId)?.name;
    }
    if (channel.permissionOverwrites) {
      const everyoneOw = channel.permissionOverwrites.cache.get(everyoneRole.id);
      if (everyoneOw) {
        entry.v = !everyoneOw.deny.has(PermissionFlagsBits.ViewChannel);
      } else {
        entry.v = hasPerm(everyoneBit, "ViewChannel");
      }
    }
    channels.push(entry);
  }

  const emojis = guild.emojis.cache.map((e) => e.name);

  const context = {
    s: guild.name,
    mc: guild.memberCount,
    o: "812812088502255636",
    roles,
    channels,
    emojis,
    boost: guild.premiumTier,
  };

  return context;
}
