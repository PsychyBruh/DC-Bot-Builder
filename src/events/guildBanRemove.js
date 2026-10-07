import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { logMod, findExecutor, AuditLogEvent } from "../features/logging.js";

export const name = "guildBanRemove";

export async function execute(ban) {
  const audit = await findExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
  await logMod(ban.guild, baseEmbed(COLORS.success)
    .setTitle("🔓 Member unbanned")
    .setDescription(`**User:** ${ban.user} (${ban.user.tag})\n**By:** ${audit?.executor ? `${audit.executor}` : "unknown"}`)
    .setFooter({ text: `ID: ${ban.user.id}` }));
}
