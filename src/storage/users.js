import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "users.json");

const users = new Map();

function ensureDefaults(data) {
  if (!data.balance) data.balance = 1000;
  if (!data.rep) data.rep = { given: {}, total: 0 };
  if (!data.streak) data.streak = { count: 0, last: null };
  if (!data.xp) data.xp = 0;
  if (!data.level) data.level = 0;
  if (!data.afk) data.afk = null;
  if (!data.coinsWon) data.coinsWon = 0;
  if (!data.coinsLost) data.coinsLost = 0;
  if (!data.triviaScore) data.triviaScore = 0;
  if (!data.triviaAnswered) data.triviaAnswered = 0;
  if (!data.duelsWon) data.duelsWon = 0;
  if (!data.duelsLost) data.duelsLost = 0;
  if (!data.slotsWon) data.slotsWon = 0;
  if (!data.privateRoomId) data.privateRoomId = null;
  if (!data.lastSeen) data.lastSeen = Date.now();
  return data;
}

export function loadUsers() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = JSON.parse(raw);
      for (const [uid, udata] of Object.entries(data)) {
        users.set(uid, ensureDefaults(udata));
      }
      console.log(`Loaded data for ${users.size} user(s)`);
    }
  } catch (err) {
    console.error("Failed to load users:", err.message);
  }
}

function save() {
  try {
    const obj = {};
    for (const [uid, udata] of users) obj[uid] = udata;
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save users:", err.message);
  }
}

export function getUser(userId) {
  let data = users.get(userId);
  if (!data) {
    data = {};
    ensureDefaults(data);
    users.set(userId, data);
    save();
  }
  ensureDefaults(data);
  return data;
}

export function updateUser(userId, updater) {
  const data = getUser(userId);
  const updated = updater(data);
  users.set(userId, ensureDefaults(updated || data));
  save();
}

export function adjustBalance(userId, amount) {
  const data = getUser(userId);
  data.balance = Math.max(0, (data.balance || 0) + amount);
  if (amount > 0) data.coinsWon = (data.coinsWon || 0) + amount;
  else data.coinsLost = (data.coinsLost || 0) + Math.abs(amount);
  save();
  return data.balance;
}

export function getBalance(userId) {
  return getUser(userId).balance || 0;
}

export function giveRep(fromUserId, toUserId, reason = "") {
  const today = new Date().toISOString().slice(0, 10);
  const giver = getUser(fromUserId);
  if (!giver.rep.given) giver.rep.given = {};
  if (giver.rep.given[toUserId] === today) return { ok: false, reason: "already_gave_rep_today" };
  giver.rep.given[toUserId] = today;
  const receiver = getUser(toUserId);
  receiver.rep.total = (receiver.rep.total || 0) + 1;
  save();
  return { ok: true };
}

export function checkInStreak(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const data = getUser(userId);
  if (data.streak.last === today) return { ok: false, streak: data.streak.count };
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (data.streak.last === yesterday) data.streak.count = (data.streak.count || 0) + 1;
  else data.streak.count = 1;
  data.streak.last = today;
  save();
  return { ok: true, streak: data.streak.count };
}

export function addXp(userId, amount) {
  const data = getUser(userId);
  data.xp = (data.xp || 0) + amount;
  const oldLevel = data.level || 0;
  data.level = Math.floor(0.1 * Math.sqrt(data.xp));
  save();
  return { leveledUp: data.level > oldLevel, level: data.level, xp: data.xp };
}

export function setAfk(userId, reason) {
  const data = getUser(userId);
  data.afk = { reason, since: Date.now() };
  save();
}

export function clearAfk(userId) {
  const data = getUser(userId);
  data.afk = null;
  save();
}

export function getAfk(userId) {
  return getUser(userId).afk;
}

export function clearAllUserData() {
  users.clear();
  save();
}

export function getTopUsers(sortKey, limit = 10) {
  const arr = [];
  for (const [uid, data] of users) {
    arr.push({ id: uid, ...data });
  }
  arr.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
  return arr.slice(0, limit);
}
