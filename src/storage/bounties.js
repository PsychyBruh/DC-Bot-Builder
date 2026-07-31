import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { updateUser, getUser, adjustBalance } from "./users.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOUNTY_FILE = path.join(__dirname, "..", "..", "data", "bounties.json");

let bounties = {}; // { targetId: [ { from, amount, at } ] }

function load() {
  try {
    if (fs.existsSync(BOUNTY_FILE)) {
      bounties = JSON.parse(fs.readFileSync(BOUNTY_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Failed to load bounties:", err.message);
  }
}

function save() {
  try {
    const dir = path.dirname(BOUNTY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BOUNTY_FILE, JSON.stringify(bounties, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save bounties:", err.message);
  }
}

load();

export function placeBounty(fromId, targetId, amount) {
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
  return (bounties[targetId] || []).reduce((s, b) => s + b.amount, 0);
}

export function getBounty(targetId) {
  return bounties[targetId] || [];
}

export function claimBounty(claimerId, targetId) {
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
