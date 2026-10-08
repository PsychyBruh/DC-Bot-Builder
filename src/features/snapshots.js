import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Snapshots of every channel, role and permission overwrite (every 6 h, before blueprint builds,
// and before anti-nuke restores). Used to re-create things a compromised account deleted.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "..", "..", "data", "snapshots");

export function takeSnapshot(guild) {
  const snap = {
    at: Date.now(),
    roles: guild.roles.cache.filter((r) => r.id !== guild.id && !r.managed).map((r) => ({
      id: r.id, name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: r.permissions.bitfield.toString(), position: r.position,
    })),
    channels: guild.channels.cache.filter((c) => !c.isThread()).map((c) => ({
      id: c.id, name: c.name, type: c.type, parentId: c.parentId, position: c.rawPosition, topic: c.topic || null,
      nsfw: !!c.nsfw, rateLimitPerUser: c.rateLimitPerUser || 0, userLimit: c.userLimit || 0, bitrate: c.bitrate || undefined,
      availableTags: c.availableTags?.map((t) => ({ name: t.name, moderated: t.moderated, emoji: t.emoji })) || undefined,
      overwrites: c.permissionOverwrites?.cache.map((o) => ({ id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() })) || [],
    })),
  };
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, `${guild.id}.json`), JSON.stringify(snap));
  return snap;
}

export function loadSnapshot(guildId) {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, `${guildId}.json`), "utf-8")); } catch { return null; }
}

export async function snapshotAll(client) {
  for (const guild of client.guilds.cache.values()) {
    try { takeSnapshot(guild); } catch (err) { console.error(`snapshot ${guild.name}:`, err.message); }
  }
}

// Re-create channels/roles that are in the snapshot but missing now. Returns names restored.
export async function restoreDeleted(guild) {
  const snap = loadSnapshot(guild.id);
  if (!snap) return [];
  const restored = [];
  const roleIdMap = {};
  // Roles first (channel overwrites may reference them)
  for (const r of snap.roles.sort((a, b) => b.position - a.position)) {
    if (guild.roles.cache.has(r.id)) { roleIdMap[r.id] = r.id; continue; }
    try {
      const nr = await guild.roles.create({ name: r.name, colors: { primaryColor: r.color }, hoist: r.hoist, mentionable: r.mentionable, permissions: BigInt(r.permissions), reason: "anti-nuke restore" });
      roleIdMap[r.id] = nr.id;
      restored.push(`@${r.name}`);
    } catch {}
  }
  const chanIdMap = {};
  const mapOw = (list) => list.map((o) => ({ id: roleIdMap[o.id] || o.id, type: o.type, allow: BigInt(o.allow), deny: BigInt(o.deny) }))
    .filter((o) => o.type === 1 || guild.roles.cache.has(o.id) || o.id === guild.id);
  // Categories, then their channels
  for (const c of [...snap.channels.filter((x) => x.type === 4), ...snap.channels.filter((x) => x.type !== 4)]) {
    if (guild.channels.cache.has(c.id)) { chanIdMap[c.id] = c.id; continue; }
    try {
      const nc = await guild.channels.create({
        name: c.name, type: c.type, parent: c.parentId ? (chanIdMap[c.parentId] || (guild.channels.cache.has(c.parentId) ? c.parentId : null)) : null,
        topic: c.topic || undefined, nsfw: c.nsfw, rateLimitPerUser: c.rateLimitPerUser || undefined, userLimit: c.userLimit || undefined,
        availableTags: c.availableTags, permissionOverwrites: mapOw(c.overwrites), reason: "anti-nuke restore",
      });
      chanIdMap[c.id] = nc.id;
      await nc.setPosition(c.position).catch(() => {});
      restored.push(`#${c.name}`);
    } catch {}
  }
  return restored;
}
