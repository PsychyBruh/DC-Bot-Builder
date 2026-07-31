import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "cooldowns.json");

const cooldowns = new Map();

export function loadCooldowns() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = JSON.parse(raw);
      for (const [key, expires] of Object.entries(data)) {
        cooldowns.set(key, expires);
      }
    }
  } catch (err) {
    console.error("Failed to load cooldowns:", err.message);
  }
}

function save() {
  try {
    const obj = {};
    for (const [key, expires] of cooldowns) {
      if (expires > Date.now()) obj[key] = expires;
    }
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save cooldowns:", err.message);
  }
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
  save();
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
