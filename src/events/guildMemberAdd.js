import { getSettings } from "../storage/serverSettings.js";
import { getCachedInvites, cacheInvites } from "../storage/inviteCache.js";
import { resolveChannel, resolveRole } from "../features/config.js";
import { logJoinLeave } from "../features/logging.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { bump } from "../features/stats.js";
import { onMemberJoinRaidCheck } from "../features/safety.js";

export const name = "guildMemberAdd";

export async function execute(member) {
  const guild = member.guild;
  const settings = getSettings(guild.id);
  bump(guild.id, "joins");
  await onMemberJoinRaidCheck(member);
  // Optional per-server: joining through invite_role_code gives invite_role
  const TARGET_INVITE = settings.invite_role_code || null;
  const TARGET_ROLE = settings.invite_role || null;

  // Work out which invite was used (its use count went up since we last cached it)
  let usedInvite = null;
  const cached = getCachedInvites(guild.id);
  try {
    const current = await guild.invites.fetch();
    cacheInvites(guild.id, current);
    for (const [, inv] of current) {
      const prev = cached.get(inv.code);
      if (prev && inv.uses > prev.uses) { usedInvite = inv; break; }
    }
  } catch {}
  if (TARGET_INVITE && TARGET_ROLE && usedInvite?.code === TARGET_INVITE) {
    const role = guild.roles.cache.get(TARGET_ROLE) || guild.roles.cache.find((r) => r.name === TARGET_ROLE);
    if (role) await member.roles.add(role).catch(() => {});
  }

  // Auto roles
  for (const key of ["auto_role", "member_role", "unverified_role"]) {
    const role = settings[key] ? resolveRole(guild, key, []) : null;
    if (role) await member.roles.add(role).catch(() => {});
  }

  // Join log
  const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
  await logJoinLeave(guild, baseEmbed(COLORS.success)
    .setTitle("📥 Member joined")
    .setThumbnail(member.user.displayAvatarURL())
    .setDescription([
      `${member} (${member.user.tag})`,
      `**Account created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>${ageDays < 7 ? " ⚠️ new account" : ""}`,
      usedInvite ? `**Invite:** \`${usedInvite.code}\`${usedInvite.inviter ? ` by ${usedInvite.inviter.tag}` : ""}` : null,
      `**Member count:** ${guild.memberCount}`,
    ].filter(Boolean).join("\n"))
    .setFooter({ text: `ID: ${member.id}` }));

  // Welcome message + image card (unless this server welcomes on verify instead)
  if (settings.welcome_on !== "verify") {
    const { postWelcome } = await import("../features/welcome.js");
    await postWelcome(member);
  }
}
