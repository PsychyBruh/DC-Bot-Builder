import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { logMod, findExecutor, AuditLogEvent } from "../features/logging.js";
import { recordDestructive } from "../features/safety.js";

export const name = "channelDelete";

export async function execute(channel) {
  if (!channel.guild) return;
  const audit = await findExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
  if (audit?.executor) await recordDestructive(channel.guild, audit.executor, "channel");
  await logMod(channel.guild, baseEmbed(COLORS.danger).setTitle("🗑️ Channel deleted")
    .setDescription(`**#${channel.name}**\n**By:** ${audit?.executor ? `${audit.executor}` : "unknown"}`));
}
