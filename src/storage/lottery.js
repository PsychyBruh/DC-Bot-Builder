import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { adjustBalance } from "./users.js";
import { writeJsonAtomic, readJsonSafe } from "../services/safeWrite.js";

// draw() / checkAndDraw() return { winnerId, pot, forced, channelId, refunded }
// channelId = where the winner last bought a ticket (for the announcement).
// A round with fewer than 2 distinct players refunds tickets and keeps the seed.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOTTERY_FILE = path.join(__dirname, "..", "..", "data", "lottery.json");
const SEED = 1000;

let state = {
  jackpot: SEED,
  tickets: [], // [{ userId, at, channelId }]
  lastDraw: Date.now(),
  ticketPrice: 100,
  drawInterval: 60 * 60 * 1000, // hourly draw
};

function load() {
  const data = readJsonSafe(LOTTERY_FILE, null);
  if (data && typeof data === "object") state = { ...state, ...data };
}

function save() {
  try {
    const dir = path.dirname(LOTTERY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJsonAtomic(LOTTERY_FILE, state);
  } catch (err) { console.error("Failed to save lottery:", err.message); }
}

load();

export function getLottery() { return state; }

export function buyTicket(userId, channelId = null) {
  state.tickets.push({ userId, at: Date.now(), channelId });
  state.jackpot += state.ticketPrice;
  save();
  return state.tickets.length;
}

export function myTickets(userId) {
  return state.tickets.filter((t) => t.userId === userId).length;
}

export function checkAndDraw() {
  const now = Date.now();
  if (now - state.lastDraw < state.drawInterval) return null;
  return draw();
}

export function draw(forced = false) {
  const players = new Set(state.tickets.map((t) => t.userId));
  const pot = state.jackpot;
  let winnerId = null;
  let channelId = null;
  let refunded = false;
  if (players.size >= 2) {
    const winner = state.tickets[Math.floor(Math.random() * state.tickets.length)];
    winnerId = winner.userId;
    // Last channel the winner bought a ticket in
    channelId = [...state.tickets].reverse().find((t) => t.userId === winnerId)?.channelId || null;
    adjustBalance(winnerId, pot); // lottery wins are never boosted
    state.jackpot = SEED;
  } else {
    // Not enough players: refund everyone and keep the seed for next round
    for (const t of state.tickets) adjustBalance(t.userId, state.ticketPrice);
    refunded = state.tickets.length > 0;
    state.jackpot = SEED;
  }
  state.tickets = [];
  state.lastDraw = Date.now();
  save();
  return { winnerId, pot, forced, channelId, refunded };
}

// Reset in-memory state (used by !clear before it deletes lottery.json)
export function resetLottery() {
  state = { ...state, jackpot: SEED, tickets: [], lastDraw: Date.now() };
}

export function setPrice(p) { state.ticketPrice = p; save(); }
