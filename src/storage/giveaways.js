import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeJsonAtomic, readJsonSafe } from "../services/safeWrite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "giveaways.json");

const giveaways = new Map();

export function loadGiveaways() {
  const data = readJsonSafe(DATA_FILE, {}) || {};
  for (const [id, giveaway] of Object.entries(data)) giveaways.set(id, giveaway);
  console.log(`Loaded ${giveaways.size} giveaway(s)`);
}

function save() {
  try {
    const obj = {};
    for (const [id, giveaway] of giveaways) obj[id] = giveaway;
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJsonAtomic(DATA_FILE, obj);
  } catch (err) {
    console.error("Failed to save giveaways:", err.message);
  }
}

export function createGiveaway(data) {
  const id = `${data.guildId}:${data.channelId}:${Date.now()}`;
  const giveaway = { ...data, id, entries: [], ended: false, winnerId: null };
  giveaways.set(id, giveaway);
  save();
  return giveaway;
}

export function getGiveaway(id) {
  return giveaways.get(id);
}

export function addGiveawayEntry(id, userId) {
  const g = giveaways.get(id);
  if (!g || g.ended) return false;
  if (!g.entries.includes(userId)) {
    g.entries.push(userId);
    save();
  }
  return true;
}

export function endGiveaway(id, winnerId = null) {
  const g = giveaways.get(id);
  if (!g) return null;
  g.ended = true;
  g.winnerId = winnerId;
  save();
  return g;
}

export function removeGiveaway(id) {
  giveaways.delete(id);
  save();
}

export function getActiveGiveaways(guildId = null) {
  return [...giveaways.values()].filter((g) => !g.ended && (!guildId || g.guildId === guildId));
}

export function clearAllGiveaways() {
  giveaways.clear();
  save();
}
