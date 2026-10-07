import { featureData, saveFeatures } from "./config.js";

// Weekly counters for the staff report. featureData "stats": { weekStart, joins, leaves, messages: {uid: n}, ticketsClosed, automodHits, warnings }
function currentWeekStart() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

export function weekStats(guildId) {
  const s = featureData(guildId, "stats", {});
  if (!s.weekStart) Object.assign(s, { weekStart: currentWeekStart(), joins: 0, leaves: 0, messages: {}, ticketsClosed: 0, automodHits: 0, warnings: 0 });
  return s;
}

export function bump(guildId, key, n = 1) {
  const s = weekStats(guildId);
  s[key] = (s[key] || 0) + n;
  saveFeatures();
}

const msgBuffer = new Map(); // batch message counts; flushed by the scheduler
export function countMessage(guildId, userId) {
  const k = `${guildId}:${userId}`;
  msgBuffer.set(k, (msgBuffer.get(k) || 0) + 1);
}
export function flushMessageCounts() {
  if (!msgBuffer.size) return;
  for (const [k, n] of msgBuffer) {
    const [g, u] = k.split(":");
    const s = weekStats(g);
    s.messages[u] = (s.messages[u] || 0) + n;
  }
  msgBuffer.clear();
  saveFeatures();
}

// Returns last week's numbers and starts a fresh week.
export function rollWeek(guildId) {
  flushMessageCounts();
  const s = weekStats(guildId);
  const snapshot = JSON.parse(JSON.stringify(s));
  Object.assign(s, { weekStart: currentWeekStart(), joins: 0, leaves: 0, messages: {}, ticketsClosed: 0, automodHits: 0, warnings: 0 });
  saveFeatures();
  return snapshot;
}
