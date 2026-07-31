import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "privateRooms.json");

const rooms = new Map();

export function loadPrivateRooms() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = JSON.parse(raw);
      for (const [id, room] of Object.entries(data)) {
        rooms.set(id, room);
      }
      console.log(`Loaded ${rooms.size} private room(s)`);
    }
  } catch (err) {
    console.error("Failed to load private rooms:", err.message);
  }
}

function save() {
  try {
    const obj = {};
    for (const [id, room] of rooms) obj[id] = room;
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
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
    save();
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
