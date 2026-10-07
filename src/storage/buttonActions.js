import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeJsonAtomic, readJsonSafe } from "../services/safeWrite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "buttons.json");

const actions = new Map();
let counter = 0;

export function loadButtonActions() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = readJsonSafe(DATA_FILE, {}) || {};
      for (const [key, val] of Object.entries(data)) {
        actions.set(key, val);
      }
      console.log(`Loaded ${actions.size} button action(s)`);
    }
  } catch (err) {
    console.error("Failed to load button actions:", err.message);
  }
}

function save() {
  try {
    const obj = {};
    for (const [key, val] of actions) {
      obj[key] = val;
    }
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJsonAtomic(DATA_FILE, obj);
  } catch (err) {
    console.error("Failed to save button actions:", err.message);
  }
}

export function registerButtonAction(guildId, addRoleIds, removeRoleIds) {
  counter++;
  const customId = `btn_${Date.now()}_${counter}`;
  actions.set(customId, { guildId, addRoleIds, removeRoleIds });
  save();
  return customId;
}

export function getButtonAction(customId) {
  return actions.get(customId) || null;
}

export function deleteButtonAction(customId) {
  actions.delete(customId);
  save();
}

export function clearAllMemory() {
  actions.clear();
  save();
}
