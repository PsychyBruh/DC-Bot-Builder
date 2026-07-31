import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "memories.json");

const userMemories = new Map();
const globalMemories = [];
const userMoods = new Map();

export function loadMemories() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (data.users) {
        for (const [userId, entries] of Object.entries(data.users)) {
          userMemories.set(userId, entries);
        }
      }
      if (data.global) globalMemories.push(...data.global);
      if (data.moods) {
        for (const [userId, mood] of Object.entries(data.moods)) {
          userMoods.set(userId, mood);
        }
      }
      console.log(`Loaded ${globalMemories.length} global + ${userMemories.size} user memory set(s) + ${userMoods.size} mood(s)`);
    }
  } catch (err) {
    console.error("Failed to load memories:", err.message);
  }
}

function save() {
  try {
    const moods = {};
    for (const [userId, mood] of userMoods) {
      moods[userId] = mood;
    }
    const obj = { users: {}, global: globalMemories, moods };
    for (const [userId, entries] of userMemories) {
      obj.users[userId] = entries;
    }
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save memories:", err.message);
  }
}

export function saveUserMemory(userId, text) {
  const entries = userMemories.get(userId) || [];
  entries.push({ text, createdAt: Date.now() });
  userMemories.set(userId, entries);
  save();
}

export function saveGlobalMemory(text) {
  globalMemories.push({ text, createdAt: Date.now() });
  save();
}

export function getUserMemories(userId) {
  return userMemories.get(userId) || [];
}

export function getGlobalMemories() {
  return [...globalMemories];
}

export function clearAllMemory() {
  userMemories.clear();
  globalMemories.length = 0;
  userMoods.clear();
  save();
}

export function getMood(userId) {
  return userMoods.get(userId) || 0;
}

export function setMood(userId, value) {
  userMoods.set(userId, Math.max(-10, Math.min(10, value)));
  save();
}

export function adjustMood(userId, delta) {
  const current = getMood(userId);
  setMood(userId, current + delta);
  return getMood(userId);
}
