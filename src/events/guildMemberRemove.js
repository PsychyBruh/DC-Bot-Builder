import { getSettings } from "../storage/serverSettings.js";
import { resolveChannel } from "../features/config.js";
import { logJoinLeave, logMod, findExecutor, AuditLogEvent } from "../features/logging.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { bump } from "../features/stats.js";

export const name = "guildMemberRemove";

export async function execute(member) {
  const guild = member.guild;
  const settings = getSettings(guild.id);
  const tag = member.user?.tag || member.id;
  bump(guild.id, "leaves");

  // Was it a kick?
  const kick = await findExecutor(guild, AuditLogEvent.MemberKick, member.id);
  if (kick) {
    const { recordDestructive } = await import("../features/safety.js");
    await recordDestructive(guild, kick.executor, "kick", `kicked ${tag}`);
    const { bumpMap } = await import("../features/stats.js");
    bumpMap(guild.id, "modActions", `${kick.executor.id}:kick`);
    await logMod(guild, baseEmbed(COLORS.danger)
      .setTitle("👢 Member kicked")
      .setDescription(`**User:** <@${member.id}> (${tag})\n**By:** ${kick.executor}\n**Reason:** ${kick.reason || "none given"}`)
      .setFooter({ text: `ID: ${member.id}` }));
  }

  const roles = member.roles?.cache?.filter((r) => r.id !== guild.id).map((r) => `${r}`) || [];
  await logJoinLeave(guild, baseEmbed(COLORS.danger)
    .setTitle(kick ? "📤 Member left (kicked)" : "📤 Member left")
    .setThumbnail(member.user?.displayAvatarURL?.() || null)
    .setDescription([
      `<@${member.id}> (${tag})`,
      member.joinedTimestamp ? `**Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : null,
      roles.length ? `**Roles:** ${roles.join(", ")}` : null,
      `**Member count:** ${guild.memberCount}`,
    ].filter(Boolean).join("\n"))
    .setFooter({ text: `ID: ${member.id}` }));

  const channel = resolveChannel(guild, "goodbye_channel", []);
  if (!channel) return;
  const text = (settings.goodbye_message || "Goodbye {user}!")
    .replace(/{user}/g, tag)
    .replace(/{server}/g, guild.name);
  await channel.send({ embeds: [baseEmbed(COLORS.danger).setDescription(text)], allowedMentions: { parse: [] } }).catch(() => {});
}
