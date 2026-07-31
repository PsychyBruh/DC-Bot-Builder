import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKET_FILE = path.join(__dirname, "..", "..", "data", "market.json");

// Simple simulated stock market: one share "NOVA" with price that drifts hourly.
// We persist { price, lastUpdate } so price survives restarts.

let state = { price: 100, lastUpdate: 0, history: [] };

function load() {
  try {
    if (fs.existsSync(MARKET_FILE)) {
      state = JSON.parse(fs.readFileSync(MARKET_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Failed to load market:", err.message);
  }
}

function save() {
  try {
    const dir = path.dirname(MARKET_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MARKET_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save market:", err.message);
  }
}

load();

const TICK_MS = 60 * 60 * 1000; // price ticks hourly
const VOLATILITY = 0.08; // +/- 8% per tick

export function tickMarket() {
  const now = Date.now();
  if (now - state.lastUpdate < TICK_MS) return state;

  let drift = (Math.random() - 0.5) * 2 * VOLATILITY;
  // gentle mean-reversion toward 100
  drift += (100 - state.price) * 0.02;
  state.price = Math.max(10, Math.round(state.price * (1 + drift) * 100) / 100);
  state.lastUpdate = now;
  state.history.push({ price: state.price, at: now });
  if (state.history.length > 48) state.history.shift();
  save();
  return state;
}

export function getPrice() {
  tickMarket();
  return state.price;
}

export function getHistory() {
  tickMarket();
  return state.history;
}

export function applyMarketBuy(userId, shares) {
  // No state mutation needed; money math happens in users.js
  return shares * getPrice();
}

export function applyMarketSell(userId, shares) {
  return shares * getPrice();
}
