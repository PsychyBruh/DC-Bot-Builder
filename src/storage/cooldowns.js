import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeJsonAtomic, readJsonSafe } from "../services/safeWrite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "cooldowns.json");
const SAVE_DEBOUNCE_MS = 5000;

const cooldowns = new Map();
let saveTimer = null;

export function loadCooldowns() {
  const data = readJsonSafe(DATA_FILE, {});
  const now = Date.now();
  for (const [key, expires] of Object.entries(data || {})) {
    // Prune expired entries on load
    if (typeof expires === "number" && expires > now) cooldowns.set(key, expires);
  }
}

function saveNow() {
  try {
    const obj = {};
    const now = Date.now();
    for (const [key, expires] of cooldowns) {
      if (expires > now) obj[key] = expires;
      else cooldowns.delete(key);
    }
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJsonAtomic(DATA_FILE, obj);
  } catch (err) {
    console.error("Failed to save cooldowns:", err.message);
  }
}

// Debounced: at most one disk write every SAVE_DEBOUNCE_MS instead of one per command.
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, SAVE_DEBOUNCE_MS);
  saveTimer.unref?.();
}

export function checkCooldown(userId, command, durationMs) {
  const key = `${userId}:${command}`;
  const now = Date.now();
  const expires = cooldowns.get(key) || 0;
  if (expires > now) {
    return { onCooldown: true, remainingMs: expires - now };
  }
  cooldowns.set(key, now + durationMs);
  save();
  return { onCooldown: false };
}

export function clearAllCooldowns() {
  cooldowns.clear();
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  saveNow();
}

export function formatCooldown(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}
