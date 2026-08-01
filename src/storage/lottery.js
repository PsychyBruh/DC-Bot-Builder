import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { adjustBalance } from "./users.js";
import { rewardCoins } from "./economy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOTTERY_FILE = path.join(__dirname, "..", "..", "data", "lottery.json");

let state = {
  jackpot: 1000,
  tickets: [], // [{ userId, at }]
  lastDraw: Date.now(),
  ticketPrice: 100,
  drawInterval: 60 * 60 * 1000, // hourly draw
};

function load() {
  try {
    if (fs.existsSync(LOTTERY_FILE)) {
      state = { ...state, ...JSON.parse(fs.readFileSync(LOTTERY_FILE, "utf-8")) };
    }
  } catch (err) { console.error("Failed to load lottery:", err.message); }
}

function save() {
  try {
    const dir = path.dirname(LOTTERY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOTTERY_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) { console.error("Failed to save lottery:", err.message); }
}

load();

export function getLottery() { return state; }

export function buyTicket(userId) {
  state.tickets.push({ userId, at: Date.now() });
  state.jackpot += state.ticketPrice;
  save();
  return state.tickets.length;
}

export function myTickets(userId) {
  return state.tickets.filter((t) => t.userId === userId).length;
}

export function checkAndDraw(client) {
  const now = Date.now();
  if (now - state.lastDraw < state.drawInterval) return null;
  return draw();
}

export function draw(forced = false) {
  const winner = state.tickets.length
    ? state.tickets[Math.floor(Math.random() * state.tickets.length)]
    : null;
  const pot = state.jackpot;
  let winnerId = null;
  if (winner) {
    rewardCoins(winner.userId, pot);
    winnerId = winner.userId;
  }
  state.tickets = [];
  state.jackpot = 1000;
  state.lastDraw = Date.now();
  save();
  return { winnerId, pot, forced };
}

export function setPrice(p) { state.ticketPrice = p; save(); }
