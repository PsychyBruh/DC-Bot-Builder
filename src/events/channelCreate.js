import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { logMod, findExecutor, AuditLogEvent } from "../features/logging.js";

export const name = "channelCreate";

export async function execute(channel) {
  if (!channel.guild) return;
  const audit = await findExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
  if (audit?.executor?.id === channel.client.user.id) return; // bot's own (tickets, rooms, builds)
  await logMod(channel.guild, baseEmbed(COLORS.info).setTitle("➕ Channel created").setDescription(`${channel} (\`${channel.name}\`)\n**By:** ${audit?.executor ? `${audit.executor}` : "unknown"}`));
}
