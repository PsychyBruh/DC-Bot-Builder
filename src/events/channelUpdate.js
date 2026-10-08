import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { logMod, findExecutor, AuditLogEvent } from "../features/logging.js";

export const name = "channelUpdate";

export async function execute(oldCh, newCh) {
  if (!newCh.guild || newCh.isThread?.()) return;
  const changes = [];
  if (oldCh.name !== newCh.name) changes.push(`**Name:** \`${oldCh.name}\` → \`${newCh.name}\``);
  if ((oldCh.topic || "") !== (newCh.topic || "")) changes.push("**Topic changed**");
  if ((oldCh.rateLimitPerUser || 0) !== (newCh.rateLimitPerUser || 0)) changes.push(`**Slowmode:** ${oldCh.rateLimitPerUser || 0}s → ${newCh.rateLimitPerUser || 0}s`);
  if (oldCh.parentId !== newCh.parentId) changes.push("**Moved category**");
  const ow = (c) => JSON.stringify(c.permissionOverwrites?.cache.map((o) => [o.id, o.allow.bitfield.toString(), o.deny.bitfield.toString()]) || []);
  if (ow(oldCh) !== ow(newCh)) changes.push("**Permissions changed**");
  if (!changes.length) return;
  const audit = await findExecutor(newCh.guild, AuditLogEvent.ChannelUpdate, newCh.id) || await findExecutor(newCh.guild, AuditLogEvent.ChannelOverwriteUpdate, newCh.id);
  if (audit?.executor?.id === newCh.client.user.id) return; // bot's own edits (raid slowmode, builds, counters)
  if (/^(👥|🟢|🔴|🧪|🚀)/.test(newCh.name) && !audit) return; // counter/status renames
  await logMod(newCh.guild, baseEmbed(COLORS.info).setTitle("✏️ Channel updated").setDescription(`${newCh}\n${changes.join("\n")}\n**By:** ${audit?.executor ? `${audit.executor}` : "unknown"}`));
}
