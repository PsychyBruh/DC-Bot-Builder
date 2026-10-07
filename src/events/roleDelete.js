import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { logMod, findExecutor, AuditLogEvent } from "../features/logging.js";
import { recordDestructive } from "../features/safety.js";

export const name = "roleDelete";

export async function execute(role) {
  const audit = await findExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
  if (audit?.executor) await recordDestructive(role.guild, audit.executor, "role");
  await logMod(role.guild, baseEmbed(COLORS.danger).setTitle("🗑️ Role deleted")
    .setDescription(`**@${role.name}**\n**By:** ${audit?.executor ? `${audit.executor}` : "unknown"}`));
}
