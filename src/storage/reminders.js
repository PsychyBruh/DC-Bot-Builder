import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "reminders.json");

const reminders = new Map();

export function loadReminders() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = JSON.parse(raw);
      for (const [id, reminder] of Object.entries(data)) {
        reminders.set(id, reminder);
      }
      console.log(`Loaded ${reminders.size} reminder(s)`);
    }
  } catch (err) {
    console.error("Failed to load reminders:", err.message);
  }
}

function save() {
  try {
    const obj = {};
    for (const [id, reminder] of reminders) obj[id] = reminder;
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
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
