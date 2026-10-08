import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { logMod, findExecutor, AuditLogEvent } from "../features/logging.js";
import { recordDestructive, grantsDanger } from "../features/safety.js";

export const name = "roleUpdate";

export async function execute(oldRole, newRole) {
  const permsChanged = oldRole.permissions.bitfield !== newRole.permissions.bitfield;
  const nameChanged = oldRole.name !== newRole.name;
  if (!permsChanged && !nameChanged && oldRole.color === newRole.color) return;
  const audit = await findExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
  if (audit?.executor?.id === newRole.client.user.id) return; // bot's own edits (blueprint)
  if (audit?.executor && grantsDanger(oldRole.permissions, newRole.permissions)) {
    await recordDestructive(newRole.guild, audit.executor, "grant", `gave @${newRole.name} admin/manage permissions`);
  }
  const added = newRole.permissions.toArray().filter((p) => !oldRole.permissions.has(p));
  const removed = oldRole.permissions.toArray().filter((p) => !newRole.permissions.has(p));
  await logMod(newRole.guild, baseEmbed(COLORS.info).setTitle("✏️ Role updated").setDescription([
    `${newRole}${nameChanged ? ` (was \`${oldRole.name}\`)` : ""}`,
    added.length ? `**+ perms:** ${added.join(", ")}` : null,
    removed.length ? `**− perms:** ${removed.join(", ")}` : null,
    `**By:** ${audit?.executor ? `${audit.executor}` : "unknown"}`,
  ].filter(Boolean).join("\n")));
}
