import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { logMod, findExecutor, AuditLogEvent } from "../features/logging.js";

export const name = "guildMemberUpdate";

export async function execute(oldMember, newMember) {
  const guild = newMember.guild;
  if (oldMember.partial) return; // nothing to diff against

  // Timeouts
  const was = oldMember.communicationDisabledUntilTimestamp || 0;
  const now = newMember.communicationDisabledUntilTimestamp || 0;
  if (was !== now) {
    const audit = await findExecutor(guild, AuditLogEvent.MemberUpdate, newMember.id);
    const on = now > Date.now();
    await logMod(guild, baseEmbed(on ? COLORS.warning : COLORS.success)
      .setTitle(on ? "🔇 Member timed out" : "🔊 Timeout removed")
      .setDescription(`**User:** ${newMember} (${newMember.user.tag})${on ? `\n**Until:** <t:${Math.floor(now / 1000)}:F>` : ""}\n**By:** ${audit?.executor ? `${audit.executor}` : "unknown"}\n**Reason:** ${audit?.reason || "none given"}`)
      .setFooter({ text: `ID: ${newMember.id}` }));
  }

  // Role changes
  const added = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
  const removed = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));
  if (added.size || removed.size) {
    const audit = await findExecutor(guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
    // Skip changes the bot itself made (self-roles, verify, rank roles) to keep the mod log readable
    if (audit?.executor?.id === guild.members.me?.id) return;
    const lines = [];
    if (added.size) lines.push(`**Added:** ${added.map((r) => `${r}`).join(", ")}`);
    if (removed.size) lines.push(`**Removed:** ${removed.map((r) => `${r}`).join(", ")}`);
    await logMod(guild, baseEmbed(COLORS.info)
      .setTitle("🎭 Roles updated")
      .setDescription(`**User:** ${newMember} (${newMember.user.tag})\n${lines.join("\n")}\n**By:** ${audit?.executor ? `${audit.executor}` : "unknown"}`)
      .setFooter({ text: `ID: ${newMember.id}` }));
  }

  // Nickname
  if (oldMember.nickname !== newMember.nickname) {
    await logMod(guild, baseEmbed(COLORS.info)
      .setTitle("✏️ Nickname changed")
      .setDescription(`**User:** ${newMember}\n**Before:** ${oldMember.nickname || "*none*"}\n**After:** ${newMember.nickname || "*none*"}`));
  }
}
