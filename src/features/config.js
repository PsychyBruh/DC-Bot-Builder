import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PermissionFlagsBits } from "discord.js";
import { getSettings } from "../storage/serverSettings.js";
import { writeJsonAtomic, readJsonSafe } from "../services/safeWrite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "features.json");

// { [guildId]: { [namespace]: any } } — structured config/state for the server features
// (reaction roles, rank roles, tickets, stickies, starboard, suggestions, applications).
let store = readJsonSafe(DATA_FILE, {}) || {};
let saveTimer = null;

function saveNow() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJsonAtomic(DATA_FILE, store);
  } catch (err) {
    console.error("Failed to save features:", err.message);
  }
}

export function saveFeatures() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, 1000);
}

// Returns the live object for a namespace (mutate it, then call saveFeatures()).
export function featureData(guildId, ns, init = {}) {
  store[guildId] ??= {};
  store[guildId][ns] ??= init;
  return store[guildId][ns];
}

export function clearAllFeatures() {
  store = {};
  saveNow();
}

// Channels are often named like "📜・verify" or "┃rank-ups", so match on the bare words.
function normalize(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Settings key wins (ID or exact name); otherwise the first channel whose name contains one of the defaults.
export function resolveChannel(guild, settingKey, defaults = []) {
  if (!guild) return null;
  const val = settingKey ? getSettings(guild.id)[settingKey] : null;
  const text = (c) => c.isTextBased?.() && !c.isThread?.();
  if (val) {
    const byVal = guild.channels.cache.get(val) || guild.channels.cache.find((c) => c.name === val && text(c));
    if (byVal) return byVal;
  }
  for (const d of defaults) {
    const n = normalize(d);
    const exact = guild.channels.cache.find((c) => text(c) && normalize(c.name) === n);
    if (exact) return exact;
  }
  for (const d of defaults) {
    const n = normalize(d);
    const loose = guild.channels.cache.find((c) => text(c) && normalize(c.name).includes(n));
    if (loose) return loose;
  }
  return null;
}

export function resolveRole(guild, settingKey, defaults = []) {
  if (!guild) return null;
  const val = settingKey ? getSettings(guild.id)[settingKey] : null;
  if (val) {
    const byVal = guild.roles.cache.get(val) || guild.roles.cache.find((r) => r.name === val);
    if (byVal) return byVal;
  }
  for (const d of defaults) {
    const n = normalize(d);
    const r = guild.roles.cache.find((x) => normalize(x.name) === n);
    if (r) return r;
  }
  return null;
}

// "Staff" = the staff_role and every role above it (or any role in staff_roles), plus Administrator/Manage Server.
export function isStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  if (memberHasAny(member, "staff_roles")) return true;
  return memberAtLeast(member, "staff_role", ["staff", "moderator", "mod"]);
}

// Member's highest role is at or above the role in `settingKey` (e.g. "Senior Moderator and above").
export function memberAtLeast(member, settingKey, defaults = []) {
  if (!member?.roles) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  const role = resolveRole(member.guild, settingKey, defaults);
  if (!role) return false;
  return member.roles.cache.has(role.id) || member.roles.highest.position >= role.position;
}

// Comma-separated role list setting → roles
export function resolveRoles(guild, settingKey, defaults = []) {
  if (!guild) return [];
  const raw = getSettings(guild.id)[settingKey];
  const names = raw ? String(raw).split(",").map((x) => x.trim().replace(/^<@&(\d+)>$/, "$1").replace(/^@/, "")).filter(Boolean) : defaults;
  const out = [];
  for (const n of names) {
    const r = guild.roles.cache.get(n) || guild.roles.cache.find((x) => x.name === n) || guild.roles.cache.find((x) => normalize(x.name) === normalize(n));
    if (r && !out.includes(r)) out.push(r);
  }
  return out;
}

export function memberHasAny(member, settingKey, defaults = []) {
  if (!member?.roles) return false;
  return resolveRoles(member.guild, settingKey, defaults).some((r) => member.roles.cache.has(r.id));
}

// Allowed if Administrator, or in the role list setting, or at/above the "min" role setting.
export function memberAllowed(member, listKey, minKey, { staffFallback = true } = {}) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  const g = getSettings(member.guild.id);
  if (listKey && g[listKey]) return memberHasAny(member, listKey) || (minKey && g[minKey] ? memberAtLeast(member, minKey) : false);
  if (minKey && g[minKey]) return memberAtLeast(member, minKey);
  return staffFallback ? isStaff(member) : false;
}

// Roles the bot can't manage (above its own highest role, managed, @everyone) fail silently otherwise.
export function canManageRole(guild, role) {
  const me = guild.members.me;
  return role && !role.managed && role.id !== guild.id && me && role.position < me.roles.highest.position;
}

// List settings ("general, chat" or IDs) → channels. Falls back to the default names.
export function resolveChannels(guild, settingKey, defaults = []) {
  if (!guild) return [];
  const raw = getSettings(guild.id)[settingKey];
  const names = raw ? raw.split(",").map((s) => s.trim().replace(/^<#(\d+)>$/, "$1")).filter(Boolean) : defaults;
  const out = new Map();
  for (const n of names) {
    const byId = guild.channels.cache.get(n);
    if (byId) { out.set(byId.id, byId); continue; }
    const norm = normalize(n);
    for (const c of guild.channels.cache.values()) {
      if (c.isThread?.()) continue;
      if (normalize(c.name) === norm || (!raw && normalize(c.name).includes(norm))) out.set(c.id, c);
    }
  }
  return [...out.values()];
}

// Forum channels aren't "text based", so they need their own lookup.
export function resolveForum(guild, settingKey, defaults = []) {
  return resolveChannels(guild, settingKey, defaults).find((c) => c.type === 15 /* GuildForum */) || null;
}

export function settingOn(guildId, key, defaultOn = true) {
  const v = getSettings(guildId)[key];
  return v === undefined || v === null || v === "" ? defaultOn : v === "true";
}

export function settingNum(guildId, key, def) {
  const n = parseFloat(getSettings(guildId)[key]);
  return Number.isFinite(n) ? n : def;
}

// Sends an alert to the staff alert channel (falls back to mod log).
export async function staffAlert(guild, payload) {
  const ch = resolveChannel(guild, "staff_alert_channel", ["staff-alerts", "mod-chat", "staff-chat"])
    || resolveChannel(guild, "mod_log_channel", ["mod-log"]);
  if (ch) await ch.send(payload).catch(() => {});
}
