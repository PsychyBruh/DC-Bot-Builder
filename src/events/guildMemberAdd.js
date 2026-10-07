import { AttachmentBuilder } from "discord.js";
import { getSettings } from "../storage/serverSettings.js";
import { getCachedInvites, cacheInvites } from "../storage/inviteCache.js";
import { resolveChannel, resolveRole } from "../features/config.js";
import { logJoinLeave } from "../features/logging.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { bump } from "../features/stats.js";
import { onMemberJoinRaidCheck } from "../features/safety.js";

export const name = "guildMemberAdd";

// Defaults for the original server; other servers can set invite_role_code / invite_role via settings.
const DEFAULT_INVITE = "qMM6Cm4bjV";
const DEFAULT_INVITE_ROLE = "1519434722327924797";

export async function execute(member) {
  const guild = member.guild;
  const settings = getSettings(guild.id);
  bump(guild.id, "joins");
  await onMemberJoinRaidCheck(member);
  const TARGET_INVITE = settings.invite_role_code || DEFAULT_INVITE;
  const TARGET_ROLE = settings.invite_role || DEFAULT_INVITE_ROLE;

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
  if (usedInvite?.code === TARGET_INVITE) {
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

  // Welcome message + image card
  const welcomeChannel = resolveChannel(guild, "welcome_channel", ["welcome", "welcomes", "arrivals"]);
  if (!welcomeChannel || settings.welcome_enabled === "false") return;
  const text = (settings.welcome_message || "Welcome {user} to **{server}**!")
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{server}/g, guild.name)
    .replace(/{count}/g, String(guild.memberCount));
  const payload = { content: text, allowedMentions: { users: [member.id] } };
  if (settings.welcome_card !== "false") {
    try {
      const { renderWelcomeCard } = await import("../features/welcomeCard.js");
      payload.files = [new AttachmentBuilder(await renderWelcomeCard(member), { name: "welcome.png" })];
    } catch (err) {
      console.error("welcome card failed:", err.message);
    }
  }
  await welcomeChannel.send(payload).catch(() => {});
}
