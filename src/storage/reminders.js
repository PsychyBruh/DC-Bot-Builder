import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeJsonAtomic, readJsonSafe } from "../services/safeWrite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "reminders.json");

const reminders = new Map();

export function loadReminders() {
  const data = readJsonSafe(DATA_FILE, {}) || {};
  for (const [id, reminder] of Object.entries(data)) reminders.set(id, reminder);
  console.log(`Loaded ${reminders.size} reminder(s)`);
}

function save() {
  try {
    const obj = {};
    for (const [id, reminder] of reminders) obj[id] = reminder;
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJsonAtomic(DATA_FILE, obj);
  } catch (err) {
    console.error("Failed to save reminders:", err.message);
  }
}

export function addReminder(userId, channelId, guildId, message, remindAt) {
  const id = `${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  reminders.set(id, {
    id,
    userId,
    channelId,
    guildId,
    message,
    remindAt,
    createdAt: Date.now(),
  });
  save();
  return id;
}

export function getUserReminders(userId) {
  return [...reminders.values()].filter((r) => r.userId === userId);
}

export function removeReminder(id) {
  reminders.delete(id);
  save();
}

export function getDueReminders() {
  const now = Date.now();
  return [...reminders.values()].filter((r) => r.remindAt <= now);
}

export function clearAllReminders() {
  reminders.clear();
  save();
}
