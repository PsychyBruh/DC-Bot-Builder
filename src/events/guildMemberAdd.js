import { getSettings } from "../storage/serverSettings.js";
import { getCachedInvites, cacheInvites } from "../storage/inviteCache.js";

export const name = "guildMemberAdd";

const TARGET_INVITE = "qMM6Cm4bjV";
const TARGET_ROLE = "1519434722327924797";

export async function execute(member) {
  const guild = member.guild;

  const cached = getCachedInvites(guild.id);
  try {
    const current = await guild.invites.fetch();
    cacheInvites(guild.id, current);
    for (const [, inv] of current) {
      const prev = cached.get(inv.code);
      if (inv.code === TARGET_INVITE && prev && inv.uses > prev.uses) {
        const role = guild.roles.cache.get(TARGET_ROLE);
        if (role) await member.roles.add(role).catch(() => {});
        break;
      }
    }
  } catch {}

  const guildSettings = getSettings(guild.id);

  const autoRole = guildSettings.auto_role
    ? guild.roles.cache.find((r) => r.name === guildSettings.auto_role || r.id === guildSettings.auto_role)
    : null;
  if (autoRole) {
    await member.roles.add(autoRole).catch(() => {});
  }

  const welcomeChannel = guildSettings.welcome_channel
    ? guild.channels.cache.find((c) => c.name === guildSettings.welcome_channel || c.id === guildSettings.welcome_channel)
    : null;
  if (welcomeChannel && welcomeChannel.isTextBased() && guildSettings.welcome_message) {
    const text = guildSettings.welcome_message
      .replace(/{user}/g, `<@${member.id}>`)
      .replace(/{server}/g, guild.name);
    await welcomeChannel.send(text).catch(() => {});
  }
}
