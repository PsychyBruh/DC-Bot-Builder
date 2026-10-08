import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { logMod } from "../features/logging.js";
import { bump, bumpMap } from "../features/stats.js";

export const name = "autoModerationActionExecution";

// Discord's native AutoMod hits → mod log + weekly stats (one log per message, not per action)
const seen = new Set();
export async function execute(exec) {
  const key = `${exec.guild.id}:${exec.messageId || exec.alertSystemMessageId}:${exec.ruleId}`;
  if (seen.has(key)) return;
  seen.add(key);
  if (seen.size > 2000) seen.clear();
  const rule = exec.autoModerationRule?.name || (await exec.guild.autoModerationRules.fetch(exec.ruleId).catch(() => null))?.name || "AutoMod rule";
  bump(exec.guild.id, "automodHits");
  bumpMap(exec.guild.id, "automodByRule", rule);
  await logMod(exec.guild, baseEmbed(COLORS.danger).setTitle(`🛡️ AutoMod — ${rule}`).setDescription(
    `**User:** <@${exec.userId}>\n${exec.channelId ? `**Channel:** <#${exec.channelId}>\n` : ""}${exec.matchedKeyword ? `**Matched:** \`${exec.matchedKeyword}\`\n` : ""}${exec.content ? `\n>>> ${exec.content.slice(0, 900)}` : ""}`));
}
