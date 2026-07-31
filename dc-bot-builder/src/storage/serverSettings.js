import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "settings.json");

const settings = new Map();

export function loadSettings() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = JSON.parse(raw);
      for (const [guildId, guildSettings] of Object.entries(data)) {
        settings.set(guildId, guildSettings);
      }
      console.log(`Loaded settings for ${settings.size} guild(s)`);
    }
  } catch (err) {
    console.error("Failed to load settings:", err.message);
  }
}

function save() {
  try {
    const obj = {};
    for (const [guildId, guildSettings] of settings) {
      obj[guildId] = guildSettings;
    }
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save settings:", err.message);
  }
}

export function getSettings(guildId) {
  return settings.get(guildId) || {};
}

export function setSetting(guildId, key, value) {
  const guildSettings = settings.get(guildId) || {};
  guildSettings[key] = value;
  settings.set(guildId, guildSettings);
  save();
}

export function removeSetting(guildId, key) {
  const guildSettings = settings.get(guildId);
  if (guildSettings) {
    delete guildSettings[key];
    settings.set(guildId, guildSettings);
    save();
  }
}

export function clearAllSettings(guildId) {
  settings.delete(guildId);
  save();
}

export function clearAllMemory() {
  settings.clear();
  save();
}
