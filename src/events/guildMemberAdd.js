import { getSettings } from "../storage/serverSettings.js";
import { getCachedInvites, cacheInvites } from "../storage/inviteCache.js";

export const name = "guildMemberAdd";

// Defaults for the original server; other servers can set invite_role_code / invite_role via settings.
const DEFAULT_INVITE = "qMM6Cm4bjV";
const DEFAULT_INVITE_ROLE = "1519434722327924797";

export async function execute(member) {
  const guild = member.guild;
  const guildSettings = getSettings(guild.id);
  const TARGET_INVITE = guildSettings.invite_role_code || DEFAULT_INVITE;
  const TARGET_ROLE = guildSettings.invite_role || DEFAULT_INVITE_ROLE;

  const cached = getCachedInvites(guild.id);
  try {
    const current = await guild.invites.fetch();
    cacheInvites(guild.id, current);
    for (const [, inv] of current) {
      const prev = cached.get(inv.code);
      if (inv.code === TARGET_INVITE && prev && inv.uses > prev.uses) {
        const role = guild.roles.cache.get(TARGET_ROLE) || guild.roles.cache.find((r) => r.name === TARGET_ROLE);
        if (role) await member.roles.add(role).catch(() => {});
        break;
      }
    }
  } catch {}

  const autoRole = guildSettings.auto_role
    ? guild.roles.cache.find((r) => r.name === guildSettings.auto_role || r.id === guildSettings.auto_role)
    : null;
  if (autoRole) {
    await member.roles.add(autoRole).catch(() => {});
  }

  const memberRole = guildSettings.member_role
    ? guild.roles.cache.find((r) => r.name === guildSettings.member_role || r.id === guildSettings.member_role)
    : null;
  if (memberRole) {
    await member.roles.add(memberRole).catch(() => {});
  }

  const welcomeChannel = guildSettings.welcome_channel
    ? guild.channels.cache.find((c) => c.name === guildSettings.welcome_channel || c.id === guildSettings.welcome_channel)
    : null;
  if (welcomeChannel && welcomeChannel.isTextBased() && guildSettings.welcome_message) {
    const text = guildSettings.welcome_message
      .replace(/{user}/g, `<@${member.id}>`)
      .replace(/{server}/g, guild.name);
    // Only ping the new member, never @everyone/roles that might be in the template.
    await welcomeChannel.send({ content: text, allowedMentions: { users: [member.id] } }).catch(() => {});
  }
}
