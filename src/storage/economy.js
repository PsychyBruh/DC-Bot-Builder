import { getUser, updateUser } from "./users.js";

// ============ JOBS ============
export const JOBS = [
  { id: "beggar",       name: "Beggar",         emoji: "\u{1F917}", base: 30,  cooldown: 60 * 1000,        desc: "Low pay, very fast cooldown" },
  { id: "farmer",       name: "Farmer",         emoji: "\u{1F33E}", base: 80,  cooldown: 5 * 60 * 1000,    desc: "Steady pay, fast" },
  { id: "miner",        name: "Miner",          emoji: "\u{26CF}\uFE0F", base: 150, cooldown: 10 * 60 * 1000, desc: "Good pay, medium" },
  { id: "fisher",       name: "Fisherman",      emoji: "\u{1F3A3}", base: 220, cooldown: 20 * 60 * 1000,   desc: "Better pay, slower" },
  { id: "blacksmith",   name: "Blacksmith",     emoji: "\u{1F528}", base: 350, cooldown: 30 * 60 * 1000,   desc: "High pay, slow" },
  { id: "merchant",     name: "Merchant",       emoji: "\u{1F4BC}", base: 500, cooldown: 60 * 60 * 1000,   desc: "Excellent pay, hourly" },
  { id: "knight",       name: "Knight",         emoji: "\u{1F396}\uFE0F", base: 800,  cooldown: 90 * 60 * 1000, desc: "Elite pay, very slow" },
  { id: "wizard",       name: "Wizard",         emoji: "\u{1F9D9}", base: 1200, cooldown: 120 * 60 * 1000, desc: "Top pay, slowest" },
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
  { id: "trophy",         name: "Golden Trophy",     emoji: "\u{1F3C6}", price: 5000, sell: 2500, type: "collectible", desc: "Pure status. Just for showing off." },
];

export const ITEM_MAP = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// ============ PROPERTIES ============
export const PROPERTIES = [
  { id: "shack",    name: "Shack",          price: 2000,   income: 30,   emoji: "\u{1F3D8}\uFE0F", desc: "Small passive income each work" },
  { id: "house",    name: "Cosy House",     price: 8000,   income: 100,  emoji: "\u{1F3E0}", desc: "Decent passive income" },
  { id: "villa",    name: "Villa",          price: 25000,  income: 400,  emoji: "\u{1F3E1}", desc: "Great passive income" },
  { id: "mansion",  name: "Mansion",        price: 80000,  income: 1500, emoji: "\u{1F3E2}", desc: "Huge passive income" },
  { id: "castle",   name: "Castle",         price: 250000, income: 5000, emoji: "\u{1F3F0}", desc: "Royalty-grade income" },
];

export const PROPERTY_MAP = Object.fromEntries(PROPERTIES.map((p) => [p.id, p]));

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
