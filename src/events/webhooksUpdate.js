import { logMod, AuditLogEvent } from "../features/logging.js";
import { recordDestructive } from "../features/safety.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";

export const name = "webhooksUpdate";

export async function execute(channel) {
  const guild = channel.guild;
  if (!guild) return;
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, limit: 3 });
    const entry = logs.entries.find((e) => Date.now() - e.createdTimestamp < 10_000);
    if (!entry?.executor) return;
    await recordDestructive(guild, entry.executor, "webhook", `webhook in #${channel.name}`);
    await logMod(guild, baseEmbed(COLORS.warning).setTitle("🪝 Webhook created").setDescription(`In ${channel} by ${entry.executor}`));
  } catch {}
}
