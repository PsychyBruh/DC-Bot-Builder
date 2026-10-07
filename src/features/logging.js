import { AuditLogEvent } from "discord.js";
import { resolveChannel } from "./config.js";

const send = (ch, embed) => ch?.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});

export function modLogChannel(guild) {
  return resolveChannel(guild, "mod_log_channel", ["mod-log", "modlog", "mod-logs"]);
}
export function messageLogChannel(guild) {
  // Older setups used a single "log_channel"; keep honouring it.
  return resolveChannel(guild, "message_log_channel", ["message-log", "msg-log", "message-logs"]) || resolveChannel(guild, "log_channel", []);
}
export function joinLeaveLogChannel(guild) {
  return resolveChannel(guild, "join_leave_log_channel", ["join-leave-log", "join-leave", "joinleave-log", "join-log"]);
}

export const logMod = (guild, embed) => send(modLogChannel(guild), embed);
export const logMessage = (guild, embed) => send(messageLogChannel(guild), embed);
export const logJoinLeave = (guild, embed) => send(joinLeaveLogChannel(guild), embed);

// Who did it? Looks for a matching audit log entry from the last few seconds.
export async function findExecutor(guild, type, targetId) {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 5 });
    const entry = logs.entries.find((e) => e.target?.id === targetId && Date.now() - e.createdTimestamp < 10_000);
    return entry ? { executor: entry.executor, reason: entry.reason } : null;
  } catch {
    return null; // missing View Audit Log permission
  }
}

export { AuditLogEvent };
