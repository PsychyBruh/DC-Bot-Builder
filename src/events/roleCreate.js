import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { logMod, findExecutor, AuditLogEvent } from "../features/logging.js";
import { recordDestructive, grantsDanger } from "../features/safety.js";

export const name = "roleCreate";

export async function execute(role) {
  const audit = await findExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
  if (audit?.executor) {
    await recordDestructive(role.guild, audit.executor, "rolecreate", `created @${role.name}`);
    if (grantsDanger(null, role.permissions)) await recordDestructive(role.guild, audit.executor, "grant", `@${role.name} created with dangerous permissions`);
  }
  if (audit?.executor?.id === role.client.user.id) return; // bot's own (blueprint builds)
  await logMod(role.guild, baseEmbed(COLORS.info).setTitle("➕ Role created").setDescription(`${role} (\`${role.name}\`)\n**By:** ${audit?.executor ? `${audit.executor}` : "unknown"}`));
}
