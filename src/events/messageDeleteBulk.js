import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { logMessage } from "../features/logging.js";

export const name = "messageDeleteBulk";

export async function execute(messages, channel) {
  const guild = channel?.guild;
  if (!guild) return;
  const lines = [...messages.values()]
    .filter((m) => !m.partial)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((m) => `${m.author?.tag || "?"}: ${(m.content || "*(no text)*").slice(0, 150)}`);
  await logMessage(guild, baseEmbed(COLORS.danger)
    .setTitle(`🧹 ${messages.size} messages bulk-deleted`)
    .setDescription(`**Channel:** <#${channel.id}>\n\n${lines.join("\n") || "*(none were cached)*"}`));
}
