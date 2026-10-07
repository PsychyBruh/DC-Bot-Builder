import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeJsonAtomic, readJsonSafe } from "../services/safeWrite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "privateRooms.json");

const rooms = new Map();
let touchTimer = null;

export function loadPrivateRooms() {
  const data = readJsonSafe(DATA_FILE, {}) || {};
  for (const [id, room] of Object.entries(data)) rooms.set(id, room);
  console.log(`Loaded ${rooms.size} private room(s)`);
}

function save() {
  try {
    const obj = {};
    for (const [id, room] of rooms) obj[id] = room;
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJsonAtomic(DATA_FILE, obj);
  } catch (err) {
    console.error("Failed to save private rooms:", err.message);
  }
}

export function registerRoom(room) {
  rooms.set(room.id, { ...room, createdAt: Date.now(), lastActivity: Date.now() });
  save();
}

export function getRoom(id) {
  return rooms.get(id);
}

export function touchRoom(id) {
  const room = rooms.get(id);
  if (room) {
    room.lastActivity = Date.now();
    // Called on every message in a room — batch the disk write instead of saving each time.
    if (!touchTimer) {
      touchTimer = setTimeout(() => { touchTimer = null; save(); }, 30_000);
      touchTimer.unref?.();
    }
  }
}

export function removeRoom(id) {
  rooms.delete(id);
  save();
}

export function getAllRooms() {
  return [...rooms.values()];
}

export function clearAllRooms() {
  rooms.clear();
  save();
}
