import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "giveaways.json");

const giveaways = new Map();

export function loadGiveaways() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = JSON.parse(raw);
      for (const [id, giveaway] of Object.entries(data)) {
        giveaways.set(id, giveaway);
      }
      console.log(`Loaded ${giveaways.size} giveaway(s)`);
    }
  } catch (err) {
    console.error("Failed to load giveaways:", err.message);
  }
}

function save() {
  try {
    const obj = {};
    for (const [id, giveaway] of giveaways) obj[id] = giveaway;
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
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
