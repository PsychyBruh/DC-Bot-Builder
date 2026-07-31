import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, "..", "..", "logs.txt");

const actionLogs = new Map();
let logCounter = 0;

export function logAction(guildId, userId, userName, action, params, beforeState, result) {
  const entry = {
    id: ++logCounter,
    timestamp: new Date().toISOString(),
    guildId,
    userId,
    userName,
    action,
    params,
    beforeState,
    result,
    success: result.success,
  };

  if (!actionLogs.has(guildId)) {
    actionLogs.set(guildId, []);
  }
  actionLogs.get(guildId).push(entry);

  const logLine = JSON.stringify(entry) + "\n";
  try {
    fs.appendFileSync(LOG_FILE, logLine, "utf-8");
  } catch (err) {
    console.error("Failed to write log:", err.message);
  }

  return entry;
}

export function getLogs(guildId, limit = 20) {
  const logs = actionLogs.get(guildId) || [];
  return logs.slice(-limit);
}

export function getLastAction(guildId) {
  const logs = actionLogs.get(guildId) || [];
  return logs.length > 0 ? logs[logs.length - 1] : null;
}

export function removeLastAction(guildId) {
  const logs = actionLogs.get(guildId) || [];
  if (logs.length > 0) {
    const removed = logs.pop();
    const logLine = JSON.stringify({ ...removed, undone: true, undoneAt: new Date().toISOString() }) + "\n";
    try {
      fs.appendFileSync(LOG_FILE, logLine, "utf-8");
    } catch (err) {
      console.error("Failed to write undo log:", err.message);
    }
    return removed;
  }
  return null;
}

export function getAllLogsFromFile(limit = 50) {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const data = fs.readFileSync(LOG_FILE, "utf-8");
    const lines = data.trim().split("\n").filter(Boolean);
    const entries = lines.map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
    return entries.slice(-limit);
  } catch {
    return [];
  }
}

export function clearAllMemory() {
  actionLogs.clear();
}
