import { getUser, updateUser, adjustBalance } from "./users.js";

// ============ JOBS ============
export const JOBS = [
  { id: "beggar",       name: "Beggar",         emoji: "\u{1F917}", base: 35,   cooldown: 60 * 1000,        desc: "Low pay, very fast cooldown" },
  { id: "farmer",       name: "Farmer",         emoji: "\u{1F33E}", base: 95,   cooldown: 5 * 60 * 1000,    desc: "Steady pay, fast" },
  { id: "miner",        name: "Miner",          emoji: "\u{26CF}\uFE0F", base: 170,  cooldown: 10 * 60 * 1000, desc: "Good pay, medium" },
  { id: "fisher",       name: "Fisherman",      emoji: "\u{1F3A3}", base: 255,  cooldown: 20 * 60 * 1000,   desc: "Better pay, slower" },
  { id: "blacksmith",   name: "Blacksmith",     emoji: "\u{1F528}", base: 395,  cooldown: 30 * 60 * 1000,   desc: "High pay, slow" },
  { id: "merchant",     name: "Merchant",       emoji: "\u{1F4BC}", base: 565,  cooldown: 60 * 60 * 1000,   desc: "Excellent pay, hourly" },
  { id: "knight",       name: "Knight",         emoji: "\u{1F396}\uFE0F", base: 905,  cooldown: 90 * 60 * 1000, desc: "Elite pay, very slow" },
  { id: "wizard",       name: "Wizard",         emoji: "\u{1F9D9}", base: 1380, cooldown: 120 * 60 * 1000, desc: "Top pay, slowest" },
];

// Switching cooldowns scale with job tier so you can't hop between high-tier jobs to dodge work cooldowns.
// Switching to a low/mid tier is fast (5min); switching into the top tiers (knight/wizard) takes longer.
// Work cooldown is tied to the *user*, not the job — so swapping jobs doesn't reset your shift timer.
export const JOB_SWITCH_COOLDOWNS = {
  beggar:     5 * 60 * 1000,
  farmer:     5 * 60 * 1000,
  miner:      10 * 60 * 1000,
  fisher:     15 * 60 * 1000,
  blacksmith: 20 * 60 * 1000,
  merchant:   30 * 60 * 1000,
  knight:     60 * 60 * 1000,
  wizard:     90 * 60 * 1000,
};

export function jobSwitchCooldown(targetJobId) {
  return JOB_SWITCH_COOLDOWNS[targetJobId] || (5 * 60 * 1000);
}

// ============ SHOP ITEMS ============
export const ITEMS = [
  { id: "coin_boost_1h",  name: "Coin Boost (1h)",  emoji: "\u{1F4B0}", price: 500,  sell: 250, type: "booster", booster: "coin",  duration: 60 * 60 * 1000, desc: "2x coin rewards for 1 hour" },
  { id: "xp_boost_1h",    name: "XP Boost (1h)",     emoji: "\u{1F4C8}", price: 400,  sell: 200, type: "booster", booster: "xp",   duration: 60 * 60 * 1000, desc: "2x XP for 1 hour" },
  { id: "luck_charm",     name: "Luck Charm",        emoji: "\u{1F340}", price: 1500, sell: 750, type: "booster", booster: "luck", duration: 30 * 60 * 1000, desc: "+20% gambling win rate for 30 min" },
  { id: "shield_24h",     name: "Shield (24h)",       emoji: "\u{1F6E1}\uFE0F", price: 1000, sell: 500, type: "booster", booster: "shield", duration: 24 * 60 * 60 * 1000, desc: "Immune to !steal for 24 hours" },
  { id: "bread",          name: "Bread",              emoji: "\u{1F35E}", price: 50,   sell: 25, type: "consumable", heal: "hp", amount: 10, desc: "+10 HP in duels" },
  { id: "health_potion",  name: "Health Potion",    emoji: "\u{1F48A}", price: 250,  sell: 125, type: "consumable", heal: "hp", amount: 40, desc: "+40 HP in duels" },
  { id: "bribe_token",    name: "Bribe Token",       emoji: "\u{1F4B9}", price: 800,  sell: 400, type: "consumable", desc: "Avoid jail once if used before arrest" },
  { id: "trophy",         name: "Golden Trophy",     emoji: "\u{1F3C6}", price: 5000, sell: 2500, type: "collectible", desc: "Use it for a permanent Golden Aura: +10% income, +5% luck, and a crown on leaderboards" },
];

export const ITEM_MAP = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// ============ PROPERTIES ============
// Property income is a TIME-BASED accrual (per hour), not per-shift.
// Owners accumulate while online or offline; claim with !collect.
// earnRate is coins-per-hour.
export const PROPERTIES = [
  { id: "shack",    name: "Shack",          price: 2000,   earnRate: 30,   emoji: "\u{1F3D8}\uFE0F", desc: "Tiny passive trickle" },
  { id: "house",    name: "Cosy House",     price: 8000,   earnRate: 100,  emoji: "\u{1F3E0}", desc: "Decent passive income" },
  { id: "villa",    name: "Villa",          price: 25000,  earnRate: 400,  emoji: "\u{1F3E1}", desc: "Great passive income" },
  { id: "mansion",  name: "Mansion",        price: 80000,  earnRate: 1500, emoji: "\u{1F3E2}", desc: "Huge passive income" },
  { id: "castle",   name: "Castle",         price: 250000, earnRate: 5000, emoji: "\u{1F3F0}", desc: "Royalty-grade income" },
];

export const PROPERTY_MAP = Object.fromEntries(PROPERTIES.map((p) => [p.id, p]));

// Cap how much back-pay can accrue (12h). Beyond this, you must claim to keep earning.
export const PROPERTY_ACCRUAL_CAP_MS = 12 * 60 * 60 * 1000;

export function computePropertyAccrual(user) {
  if (!user.property || !PROPERTY_MAP[user.property]) return { owed: 0, since: 0 };
  const prop = PROPERTY_MAP[user.property];
  const now = Date.now();
  const last = user.lastPropertyCollect || now;
  const elapsed = Math.min(now - last, PROPERTY_ACCRUAL_CAP_MS);
  const owed = Math.floor((prop.earnRate / 3600000) * elapsed);
  return { owed, since: elapsed };
}

// ============ HELPERS ============
export function addItem(userId, itemId, qty = 1) {
  updateUser(userId, (u) => {
    u.inventory = u.inventory || {};
    u.inventory[itemId] = (u.inventory[itemId] || 0) + qty;
    return u;
  });
}

export function removeItem(userId, itemId, qty = 1) {
  const u = getUser(userId);
  if (!u.inventory || !u.inventory[itemId] || u.inventory[itemId] < qty) return false;
  updateUser(userId, (d) => {
    d.inventory[itemId] -= qty;
    if (d.inventory[itemId] <= 0) delete d.inventory[itemId];
    return d;
  });
  return true;
}

export function hasItem(userId, itemId, qty = 1) {
  const u = getUser(userId);
  return (u.inventory?.[itemId] || 0) >= qty;
}

export function activeBooster(userId, type) {
  const u = getUser(userId);
  const until = u.boosters?.[type];
  return until && until > Date.now() ? until : null;
}

// Apply a coin reward with the active 2x coin boost baked in.
// Returns the actual credited amount. Negative/deductions should NOT use this.
export function rewardCoins(userId, amount) {
  const u = getUser(userId);
  const boost = activeBooster(userId, "coin") ? 2 : 1;
  const aura = u.trophyActive ? 1.1 : 1;
  const total = Math.max(0, Math.floor(amount * boost * aura));
  adjustBalance(userId, total);
  return total;
}

// ============ KARMA PERKS ============
// Karma is earned by donating to poorer players. It grants luck, wage bonuses,
// and one-time milestone rewards.
export const KARMA_MILESTONES = [
  { at: 10,   reward: 1500 },
  { at: 25,   reward: 3750 },
  { at: 50,   reward: 7500 },
  { at: 100,  reward: 15000 },
  { at: 250,  reward: 37500 },
  { at: 500,  reward: 75000, trophy: true },
  { at: 1000, reward: 150000, trophy: true },
];

// Luck from karma (+1% per karma) + Golden Aura (+5%); capped at +20%.
export function luckBonus(userId) {
  const u = getUser(userId);
  const karma = (u.karma || 0) * 0.01;
  const aura = u.trophyActive ? 0.05 : 0;
  return Math.min(0.2, karma + aura);
}

// Karma wage bonus: +1% of the shift's earnings per karma, capped at +50%.
export function karmaWageBonus(userId, base) {
  const u = getUser(userId);
  const pct = Math.min(0.5, (u.karma || 0) * 0.01);
  return Math.floor(base * pct);
}

export function setBooster(userId, type, durationMs) {
  updateUser(userId, (u) => {
    u.boosters = u.boosters || {};
    const existing = u.boosters[type] || 0;
    const start = existing > Date.now() ? existing : Date.now();
    u.boosters[type] = start + durationMs;
    return u;
  });
}

export function getInventory(userId) {
  return getUser(userId).inventory || {};
}

export function getProperty(userId) {
  return getUser(userId).property || null;
}

export function jailUser(userId, durationMs = 10 * 60 * 1000) {
  updateUser(userId, (u) => {
    u.jailed = { until: Date.now() + durationMs };
    u.stealFails = 0;
    return u;
  });
}

export function isJailed(userId) {
  const u = getUser(userId);
  return u.jailed && u.jailed.until > Date.now() ? u.jailed.until : null;
}

export function freeFromJail(userId) {
  updateUser(userId, (u) => {
    u.jailed = null;
    return u;
  });
}
