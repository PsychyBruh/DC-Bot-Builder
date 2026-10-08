import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { logMod, findExecutor, AuditLogEvent } from "../features/logging.js";

export const name = "guildBanAdd";

export async function execute(ban) {
  const audit = await findExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
  if (audit?.executor) {
    const { recordDestructive } = await import("../features/safety.js");
    await recordDestructive(ban.guild, audit.executor, "ban", `banned ${ban.user.tag}`);
    const { bumpMap } = await import("../features/stats.js");
    bumpMap(ban.guild.id, "modActions", `${audit.executor.id}:ban`);
  }
  await logMod(ban.guild, baseEmbed(COLORS.danger)
    .setTitle("🔨 Member banned")
    .setThumbnail(ban.user.displayAvatarURL())
    .setDescription(`**User:** ${ban.user} (${ban.user.tag})\n**By:** ${audit?.executor ? `${audit.executor}` : "unknown"}\n**Reason:** ${audit?.reason || ban.reason || "none given"}`)
    .setFooter({ text: `ID: ${ban.user.id}` }));
}
