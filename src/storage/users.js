import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "users.json");

const users = new Map();

function ensureDefaults(data) {
  // Only default fields that are genuinely missing (undefined).
  // Never overwrite a legitimate 0 / null with the default — that's how balance got re-seeded to 1000 when a user hit 0.
  if (data.balance === undefined) data.balance = 1000;
  if (data.rep === undefined || data.rep === null) data.rep = { given: {}, total: 0 };
  if (typeof data.rep === "object" && data.rep !== null) {
    if (data.rep.given === undefined) data.rep.given = {};
    if (data.rep.total === undefined) data.rep.total = 0;
  }
  if (data.streak === undefined || data.streak === null) data.streak = { count: 0, last: null, daily: 0, dailyLast: null, weekly: 0, weeklyLast: null };
  if (typeof data.streak === "object" && data.streak !== null) {
    if (data.streak.count === undefined) data.streak.count = 0;
    if (data.streak.last === undefined) data.streak.last = null;
    if (data.streak.daily === undefined) data.streak.daily = 0;
    if (data.streak.dailyLast === undefined) data.streak.dailyLast = null;
    if (data.streak.weekly === undefined) data.streak.weekly = 0;
    if (data.streak.weeklyLast === undefined) data.streak.weeklyLast = null;
  }
  if (data.xp === undefined) data.xp = 0;
  if (data.level === undefined) data.level = 0;
  if (data.afk === undefined) data.afk = null;
  if (data.coinsWon === undefined) data.coinsWon = 0;
  if (data.coinsLost === undefined) data.coinsLost = 0;
  if (data.triviaScore === undefined) data.triviaScore = 0;
  if (data.triviaAnswered === undefined) data.triviaAnswered = 0;
  if (data.duelsWon === undefined) data.duelsWon = 0;
  if (data.duelsLost === undefined) data.duelsLost = 0;
  if (data.slotsWon === undefined) data.slotsWon = 0;
  if (data.privateRoomId === undefined) data.privateRoomId = null;
  if (data.lastSeen === undefined) data.lastSeen = Date.now();
  // economy
  if (data.job === undefined) data.job = null;
  if (data.lastWork === undefined) data.lastWork = 0;
  if (data.inventory === undefined) data.inventory = {};
  if (data.boosters === undefined) data.boosters = {};
  if (data.shares === undefined) data.shares = 0;
  if (data.shareCost === undefined) data.shareCost = 0;
  if (data.jailed === undefined) data.jailed = null;
  if (data.stealFails === undefined) data.stealFails = 0;
  if (data.stealImmune === undefined) data.stealImmune = null;
  if (data.bountyOnMe === undefined) data.bountyOnMe = 0;
  if (data.karma === undefined) data.karma = 0;
  if (data.property === undefined) data.property = null;
  if (data.lastPropertyCollect === undefined) data.lastPropertyCollect = null;
  if (data.jobsWorked === undefined) data.jobsWorked = 0;
  if (data.giveUsed === undefined) data.giveUsed = {};
  if (data.lastLucky === undefined) data.lastLucky = 0;
  if (data.questProgress === undefined) data.questProgress = null;
  if (data.questDate === undefined) data.questDate = null;
  if (data.fishCaught === undefined) data.fishCaught = 0;
  if (data.fishBest === undefined) data.fishBest = null;
  if (data.guildsSeen === undefined) data.guildsSeen = [];
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
  data.level = Math.floor((data.xp || 0) / 100);
  let levelBonus = 0;
  if (data.level > oldLevel) {
    // Each level gained pays a bonus = new level × 50
    levelBonus = data.level * 50;
    data.balance = (data.balance || 0) + levelBonus;
    data.coinsWon = (data.coinsWon || 0) + levelBonus;
  }
  save();
  return { leveledUp: data.level > oldLevel, level: data.level, xp: data.xp, levelBonus };
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

// Record that a user was seen in a guild (cheap: only saves on first sighting).
export function recordGuildSeen(userId, guildId) {
  const data = getUser(userId);
  const list = data.guildsSeen || (data.guildsSeen = []);
  if (list.includes(guildId)) return;
  list.push(guildId);
  save();
}

// Return users who have been seen in the given guild. Server leaderboards should
// prefer this over guild member fetches so they never show a false "no data".
export function getUsersByGuild(guildId) {
  const arr = [];
  for (const [uid, data] of users) {
    if (data.guildsSeen && data.guildsSeen.includes(guildId)) {
      arr.push({ id: uid, ...data });
    }
  }
  return arr;
}

// Return raw user records (id + data) for server-scoped leaderboards.
// Caller filters by guild members.
export function getAllUsers() {
  const arr = [];
  for (const [uid, data] of users) arr.push({ id: uid, ...data });
  return arr;
}

// True if a user has ever interacted with the bot's economy (so they can be targeted).
// We treat a record as "real" if it has interacted meaningfully — balance has moved,
// a job is set, or any economy field is non-default.
export function userExists(userId) {
  const u = users.get(userId);
  if (!u) return false;
  // Default-seeded users (just getUser'd) have the initial balance of 1000 and no
  // other economy activity. Treat a user as "exists" if they have ANY economy signal:
  // job, shares, property, coinsWon/coinsLost, jobsWorked, fishCaught, etc.
  return (
    (u.coinsWon || 0) > 0 ||
    (u.coinsLost || 0) > 0 ||
    !!u.job ||
    (u.shares || 0) > 0 ||
    !!u.property ||
    (u.jobsWorked || 0) > 0 ||
    (u.fishCaught || 0) > 0 ||
    (u.triviaScore || 0) > 0 ||
    (u.triviaAnswered || 0) > 0 ||
    (u.duelsWon || 0) > 0 ||
    (u.duelsLost || 0) > 0 ||
    (u.slotsWon || 0) > 0 ||
    u.balance !== 1000 // any non-default balance proves interaction
  );
}
