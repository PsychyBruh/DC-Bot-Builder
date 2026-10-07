import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeJsonAtomic, readJsonSafe } from "../services/safeWrite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKET_FILE = path.join(__dirname, "..", "..", "data", "market.json");

// Simple simulated stock market: one share "NOVA" with price that drifts hourly.
// We persist { price, lastUpdate } so price survives restarts.

let state = { price: 100, lastUpdate: 0, history: [] };

function load() {
  const data = readJsonSafe(MARKET_FILE, null);
  if (data && typeof data === "object") state = { ...state, ...data, history: Array.isArray(data.history) ? data.history : [] };
}

function save() {
  try {
    const dir = path.dirname(MARKET_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJsonAtomic(MARKET_FILE, state);
  } catch (err) {
    console.error("Failed to save market:", err.message);
  }
}

load();

const TICK_MS = 60 * 60 * 1000; // price ticks hourly
const VOLATILITY = 0.15; // +/- 15% per tick (was 8% — too tame, investing barely moved)
const MEAN_REVERSION = 0.005; // weak pull back toward 100 (was 0.02 — strangled price)
const MIN_PRICE = 5;
const MAX_PRICE = 500;

export function tickMarket() {
  const now = Date.now();
  if (now - state.lastUpdate < TICK_MS) return state;

  // Catch up: apply one tick per elapsed hour of downtime, so price reflects
  // the right amount of drift after a restart. Cap at 24 ticks — extra downtime
  // is collapsed to "now" to avoid re-ticking on every call until caught up.
  const elapsedTicks = Math.min(24, Math.floor((now - state.lastUpdate) / TICK_MS));
  for (let i = 0; i < elapsedTicks; i++) {
    let drift = (Math.random() - 0.5) * 2 * VOLATILITY;
    drift += (100 - state.price) * MEAN_REVERSION;
    state.price = Math.max(MIN_PRICE, Math.min(MAX_PRICE, Math.round(state.price * (1 + drift) * 100) / 100));
    state.history.push({ price: state.price, at: state.lastUpdate + (i + 1) * TICK_MS });
  }
  if (state.history.length > 48) state.history = state.history.slice(-48);
  // Snap lastUpdate to now: capped catch-ups mean we deliberately lose precision
  // for any downtime beyond 24h, accepting an immediate "present" anchor.
  state.lastUpdate = now;
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
