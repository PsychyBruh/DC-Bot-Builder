import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { updateUser, adjustBalance } from "./users.js";
import { writeJsonAtomic, readJsonSafe } from "../services/safeWrite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOUNTY_FILE = path.join(__dirname, "..", "..", "data", "bounties.json");

let bounties = {}; // { targetId: [ { from, amount, at } ] }
const BOUNTY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function load() {
  bounties = readJsonSafe(BOUNTY_FILE, {}) || {};
}

function save() {
  try {
    const dir = path.dirname(BOUNTY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJsonAtomic(BOUNTY_FILE, bounties);
  } catch (err) {
    console.error("Failed to save bounties:", err.message);
  }
}

load();

// Refund bounties nobody claimed within BOUNTY_TTL_MS. Called lazily on every access.
function expire() {
  const now = Date.now();
  let changed = false;
  for (const [targetId, list] of Object.entries(bounties)) {
    const keep = [];
    for (const b of list) {
      if (now - b.at > BOUNTY_TTL_MS) { adjustBalance(b.from, b.amount); changed = true; }
      else keep.push(b);
    }
    if (keep.length) bounties[targetId] = keep;
    else delete bounties[targetId];
    if (keep.length !== list.length) {
      const total = keep.reduce((s, b) => s + b.amount, 0);
      updateUser(targetId, (u) => { u.bountyOnMe = total; return u; });
    }
  }
  if (changed) save();
}

export function placeBounty(fromId, targetId, amount) {
  expire();
  if (!bounties[targetId]) bounties[targetId] = [];
  bounties[targetId].push({ from: fromId, amount, at: Date.now() });
  save();
  const totalOnTarget = totalBounty(targetId);
  updateUser(targetId, (u) => {
    u.bountyOnMe = totalOnTarget;
    return u;
  });
  return totalOnTarget;
}

export function totalBounty(targetId) {
  expire();
  return (bounties[targetId] || []).reduce((s, b) => s + b.amount, 0);
}

export function getBounty(targetId) {
  expire();
  return bounties[targetId] || [];
}

export function claimBounty(claimerId, targetId) {
  expire();
  const list = bounties[targetId] || [];
  if (!list.length) return 0;
  const payout = list.reduce((s, b) => s + b.amount, 0);
  delete bounties[targetId];
  save();
  updateUser(targetId, (u) => {
    u.bountyOnMe = 0;
    return u;
  });
  return payout;
}
