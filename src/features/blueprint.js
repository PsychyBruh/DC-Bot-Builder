// Blueprint system: the AI turns a long server spec into ONE structured JSON plan (cheap, a single call),
// then the bot builds everything itself — no AI in the loop, rate-limit safe, resumable.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ChannelType, PermissionFlagsBits, GuildVerificationLevel, GuildExplicitContentFilter, GuildDefaultMessageNotifications } from "discord.js";
import { featureData, saveFeatures } from "./config.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { SETTING_KEYS } from "./settingsKeys.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BP_DIR = path.join(__dirname, "..", "..", "data", "blueprints");

// ============================== SCHEMA (given to the AI) ==============================
export const BLUEPRINT_SCHEMA = `Return ONE JSON object describing the whole server. Use exact names from the request (keep emoji prefixes). Omit sections that aren't requested. Keys:

"summary": short description.
"member_role": the base role given on verification (e.g. "Member").
"staff_roles": role names that count as staff (lowest moderator role and everything above).
"leadership_roles": top leadership role names.
"server": { "verification_level": "none|low|medium|high|very_high", "explicit_content_filter": "disabled|members_without_roles|all_members", "default_notifications": "all_messages|only_mentions", "enable_community": true, "afk_channel": name, "afk_timeout": seconds (60/300/900/1800/3600), "system_channel": name, "rules_channel": name, "updates_channel": name }
"roles": [ { "name", "color": "#RRGGBB" or null, "hoist": bool, "mentionable": bool, "permissions": [Discord permission names e.g. "Administrator","ManageChannels","ManageRoles","KickMembers","BanMembers","ModerateMembers","ManageMessages","ManageThreads","ManageNicknames","ViewAuditLog","MoveMembers","MuteMembers","DeafenMembers","ManageEvents","ManageWebhooks","MentionEveryone","AttachFiles","EmbedLinks","UseExternalEmojis","AddReactions","Stream","CreatePublicThreads","ManageGuild"] } ]  — ordered TOP (highest) to BOTTOM. Skip Discord-managed roles (Server Booster). Include utility roles (Muted etc.) and self-roles.
"categories": [ { "name", "view": ["@everyone"] or [role names that can see it], "send": [role names that can post] or "same_as_view" or [] (read-only for members), "overwrites": [ { "role", "allow": [perms], "deny": [perms] } ] (extra, optional),
    "channels": [ { "name", "type": "text|voice|forum|stage|announcement", "topic": "...", "slowmode": seconds, "user_limit": n, "view": [...] (optional, overrides category), "send": [...] or "same_as_view" (optional), "overwrites": [...] (optional),
                   "forum_tags": ["Tag", ...] (forum only), "guidelines": "post template (forum only)", "post_slowmode": seconds (forum only) } ] } ]
   Use "@everyone" for everyone. Voice: "send" controls Connect/Speak. Muted role should get deny SendMessages, AddReactions, Speak, SendMessagesInThreads, CreatePublicThreads on every category.
"automod": [ { "name", "trigger": "keyword|preset|mention_spam|spam", "keywords": [...], "regex": [...], "allow": [...], "presets": ["profanity","sexual_content","slurs"], "mention_limit": n, "actions": ["block","alert","timeout"], "timeout_seconds": n, "alert_channel": name, "exempt_roles": [...], "exempt_channels": [...] } ]  (max 6 keyword rules, 1 each of spam/preset/mention_spam)
"settings": { feature setting key → value (channel/role NAMES, numbers as strings, toggles "true"/"false") }. Available keys:
__SETTINGS__
"ticket_types": [ { "key", "label", "emoji", "description", "prompt" (question in the open form), "viewer_roles": [extra roles that see this type], "open_role": role given while open (optional), "form": [ {"question" (max 45 chars), "long": bool} ] (max 5, application-style types), "review_channel": channel name (applications), "review_roles": [roles allowed to accept/deny], "accept_add_roles": [...], "accept_remove_roles": [...], "deny_remove_roles": [...], "requires_link": bool (needs linked Roblox) } ]
"ticket_staff_roles": [roles that see every ticket]
"rank_roles": [ { "level": n, "role", "perk": "short text" } ], "rank_stack": false
"self_role_panels": [ { "channel", "title", "description", "mode": "dropdown|buttons|reactions", "single_choice": bool, "roles": [ { "role", "emoji", "description" } ] } ]  — ONLY self/faction/ping/language roles.
"panels": [ { "type": "verify|tickets", "channel" } ]
"stickies": [ { "channel", "text", "every": n messages } ]
"schedules": [ { "every": "daily|weekly|monthly", "day": "mon..sun or 1-28", "time": "HH:MM" (UTC), "channel", "message", "ping_roles": [...], "kind": "post|sotw|repost_latest", "source_channel": name (repost_latest) } ]
"counters": [ { "kind": "members|humans|bots|boosts|roles", "template": "👥 Members: {count}", "roles": [...] (kind roles), "category": name } ]
"roblox": { "achievements": [ { "badge_id": "", "role" } ], "leaderboards": [ { "key", "title", "format": "time|number" } ] }
"messages": [ { "channel", "title", "description" (markdown, may be long), "fields": [ {"name","value"} ], "pin": true } ]  — starter messages.

Rules: never put @everyone/@here in messages. Colours as hex. Keep descriptions faithful to the request; write full text for starter messages.`;

// ============================== GENERATION ==============================
export async function generateBlueprint(requestText) {
  const { createMessage, aiProvider } = await import("../services/ai.js");
  const settingsDoc = Object.entries(SETTING_KEYS).map(([k, v]) => `  ${k}: ${v.desc}`).join("\n");
  const model = process.env.BLUEPRINT_MODEL || (aiProvider() === "openai" ? "gpt-5-mini" : undefined);
  const res = await createMessage({
    model,
    system: "You convert Discord server specifications into a precise JSON build plan for a bot. Output only JSON.\n\n" + BLUEPRINT_SCHEMA.replace("__SETTINGS__", settingsDoc),
    messages: [{ role: "user", content: requestText }],
    max_tokens: 64000,
    json: true,
    timeoutMs: 15 * 60_000,
  });
  const text = res.content.find((b) => b.type === "text")?.text || "";
  let bp;
  try { bp = JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("The AI didn't return a valid plan. Try again.");
    bp = JSON.parse(m[0]);
  }
  if (!Array.isArray(bp.roles) && !Array.isArray(bp.categories)) throw new Error("The plan has no roles or channels — try again with the full spec.");
  return bp;
}

export function saveBlueprint(guildId, bp) {
  fs.mkdirSync(BP_DIR, { recursive: true });
  const file = path.join(BP_DIR, `${guildId}.json`);
  fs.writeFileSync(file, JSON.stringify(bp, null, 2));
  const st = featureData(guildId, "blueprint", {});
  st.createdAt = Date.now();
  st.done = {};
  st.log = [];
  saveFeatures();
  return file;
}

export function loadBlueprint(guildId) {
  try { return JSON.parse(fs.readFileSync(path.join(BP_DIR, `${guildId}.json`), "utf-8")); } catch { return null; }
}

export function blueprintFile(guildId) { return path.join(BP_DIR, `${guildId}.json`); }

export function summarize(bp) {
  const chans = (bp.categories || []).reduce((n, c) => n + (c.channels || []).length, 0);
  return [
    `**${(bp.roles || []).length}** roles · **${(bp.categories || []).length}** categories · **${chans}** channels`,
    `**${(bp.automod || []).length}** AutoMod rules · **${Object.keys(bp.settings || {}).length}** feature settings`,
    `**${(bp.ticket_types || []).length}** ticket types · **${(bp.rank_roles || []).length}** ranks · **${(bp.self_role_panels || []).length}** role panels`,
    `**${(bp.messages || []).length}** starter messages · **${(bp.stickies || []).length}** stickies · **${(bp.schedules || []).length}** schedules · **${(bp.counters || []).length}** counters`,
  ].join("\n");
}

// ============================== HELPERS ==============================
const PERM_ALIASES = {
  timeout: "ModerateMembers", mute: "MuteMembers", deafen: "DeafenMembers", kick: "KickMembers", ban: "BanMembers",
  manageserver: "ManageGuild", managethreads: "ManageThreads", attach: "AttachFiles", embed: "EmbedLinks", react: "AddReactions",
  externalemojis: "UseExternalEmojis", sendmessages: "SendMessages", view: "ViewChannel", read: "ViewChannel", connect: "Connect", speak: "Speak",
};
const PERM_LOOKUP = Object.fromEntries(Object.keys(PermissionFlagsBits).map((k) => [k.toLowerCase(), k]));
export function permBits(list = []) {
  let bits = 0n;
  for (const raw of list) {
    const k = String(raw).toLowerCase().replace(/[^a-z]/g, "");
    const name = PERM_LOOKUP[k] || PERM_ALIASES[k] || PERM_LOOKUP[(PERM_ALIASES[k] || "").toLowerCase()];
    if (name && PermissionFlagsBits[name] !== undefined) bits |= PermissionFlagsBits[name];
  }
  return bits;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
function findRole(guild, name) {
  if (!name) return null;
  if (name === "@everyone" || name === "everyone") return guild.roles.everyone;
  const id = String(name).replace(/^<@&(\d+)>$/, "$1");
  return guild.roles.cache.get(id) || guild.roles.cache.find((r) => r.name === name) || guild.roles.cache.find((r) => norm(r.name) === norm(name));
}
function findChannel(guild, name, types) {
  if (!name) return null;
  const ok = (c) => !types || types.includes(c.type);
  return guild.channels.cache.find((c) => c.name === name && ok(c)) || guild.channels.cache.find((c) => norm(c.name) === norm(name) && ok(c))
    || guild.channels.cache.find((c) => ok(c) && norm(c.name).endsWith(norm(name)) && norm(name).length >= 4);
}
const hex = (c) => (typeof c === "string" && /^#?[0-9a-f]{6}$/i.test(c) ? parseInt(c.replace("#", ""), 16) : null);

const TYPE_MAP = { text: ChannelType.GuildText, voice: ChannelType.GuildVoice, forum: ChannelType.GuildForum, stage: ChannelType.GuildStageVoice, announcement: ChannelType.GuildAnnouncement };
const isVoice = (t) => t === ChannelType.GuildVoice || t === ChannelType.GuildStageVoice;

// view/send shorthand → permission overwrites
function buildOverwrites(guild, { view, send, overwrites }, type, warnings) {
  const map = new Map(); // roleId -> { allow, deny }
  const get = (role) => { if (!map.has(role.id)) map.set(role.id, { allow: 0n, deny: 0n }); return map.get(role.id); };
  const voice = isVoice(type);
  const viewBits = PermissionFlagsBits.ViewChannel | (voice ? PermissionFlagsBits.Connect : 0n);
  const sendBits = voice ? PermissionFlagsBits.Speak | PermissionFlagsBits.Stream
    : PermissionFlagsBits.SendMessages | PermissionFlagsBits.SendMessagesInThreads | PermissionFlagsBits.CreatePublicThreads | (type === ChannelType.GuildForum ? 0n : PermissionFlagsBits.AddReactions);
  const everyone = guild.roles.everyone;
  const viewList = Array.isArray(view) ? view : null;
  if (viewList && !viewList.some((v) => /^@?everyone$/i.test(v))) {
    get(everyone).deny |= PermissionFlagsBits.ViewChannel;
    for (const n of viewList) { const r = findRole(guild, n); if (r) get(r).allow |= viewBits; else warnings.add(`role not found: ${n}`); }
  }
  const sendList = send === "same_as_view" ? null : Array.isArray(send) ? send : null;
  if (sendList) {
    if (!sendList.some((v) => /^@?everyone$/i.test(v))) {
      get(everyone).deny |= sendBits;
      // Roles that can see but aren't in the send list must not inherit sending from their own overwrite
      for (const n of sendList) { const r = findRole(guild, n); if (r) get(r).allow |= sendBits; else warnings.add(`role not found: ${n}`); }
    }
  }
  for (const o of overwrites || []) {
    const r = findRole(guild, o.role);
    if (!r) { warnings.add(`role not found: ${o.role}`); continue; }
    const e = get(r);
    e.allow |= permBits(o.allow);
    e.deny |= permBits(o.deny);
  }
  // Always let the bot in
  const me = guild.members.me;
  if (me && viewList) map.set(me.id, { allow: viewBits | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageMessages | PermissionFlagsBits.ReadMessageHistory, deny: 0n, member: true });
  return [...map.entries()].map(([id, v]) => ({ id, allow: v.allow & ~v.deny, deny: v.deny, type: v.member ? 1 : 0 }));
}

// ============================== BUILD ==============================
export async function buildBlueprint(guild, bp, onProgress = async () => {}) {
  const st = featureData(guild.id, "blueprint", {});
  st.done ??= {};
  st.log ??= [];
  const warnings = new Set();
  const done = (k) => st.done[k];
  const mark = (k) => { st.done[k] = true; saveFeatures(); };
  let step = 0;
  const progress = async (label) => { step++; if (step % 5 === 0 || /^Phase/.test(label)) await onProgress(label).catch(() => {}); };
  const me = guild.members.me;
  const myTop = me.roles.highest.position;

  // Safety net: snapshot everything before changing the server
  try { const { takeSnapshot } = await import("./snapshots.js"); takeSnapshot(guild); } catch {}

  // ---------- PHASE 1: roles ----------
  await onProgress("Phase 1/6 — roles");
  const roleObjs = [];
  for (const r of bp.roles || []) {
    if (/server booster/i.test(r.name)) continue;
    let role = findRole(guild, r.name);
    const data = { name: r.name, colors: { primaryColor: hex(r.color) ?? 0 }, hoist: !!r.hoist, mentionable: !!r.mentionable, permissions: permBits(r.permissions) };
    try {
      if (!role) role = await guild.roles.create({ ...data, reason: "blueprint" });
      else if (role.position < myTop && !role.managed) await role.edit({ ...data, reason: "blueprint" });
      else if (role.position >= myTop) warnings.add(`couldn't edit "${role.name}" (above my role)`);
      roleObjs.push(role);
    } catch (err) { warnings.add(`role ${r.name}: ${err.message}`); }
    await progress(`role ${r.name}`);
  }
  // Order: listed top→bottom, placed directly under the bot's highest role
  try {
    const manageable = roleObjs.filter((r) => r && r.editable);
    let pos = myTop - 1;
    const positions = manageable.map((r) => ({ role: r.id, position: Math.max(1, pos--) }));
    if (positions.length) await guild.roles.setPositions(positions);
  } catch (err) { warnings.add(`role ordering: ${err.message}`); }

  // ---------- PHASE 2: categories + channels (stage/announcement after Community) ----------
  await onProgress("Phase 2/6 — categories & channels");
  const deferred = [];
  const ensureChannel = async (spec, parent, inherit) => {
    let type = TYPE_MAP[spec.type || "text"] ?? ChannelType.GuildText;
    const community = guild.features.includes("COMMUNITY");
    if ((type === ChannelType.GuildStageVoice || type === ChannelType.GuildAnnouncement || type === ChannelType.GuildForum) && !community && !spec._afterCommunity) {
      deferred.push({ spec: { ...spec, _afterCommunity: true }, parent, inherit });
      return null;
    }
    if (!community && type === ChannelType.GuildStageVoice) { type = ChannelType.GuildVoice; warnings.add(`${spec.name}: stage needs Community — made a voice channel`); }
    if (!community && type === ChannelType.GuildAnnouncement) { type = ChannelType.GuildText; warnings.add(`${spec.name}: announcement needs Community — made a text channel`); }
    const hasOwn = spec.view || spec.send || spec.overwrites;
    const ow = buildOverwrites(guild, { view: spec.view ?? inherit.view, send: spec.send ?? inherit.send, overwrites: [...(inherit.overwrites || []), ...(spec.overwrites || [])] }, type, warnings);
    const opts = { name: spec.name, type, parent: parent?.id ?? null, permissionOverwrites: ow, reason: "blueprint" };
    if (spec.topic && !isVoice(type)) opts.topic = (type === ChannelType.GuildForum && spec.guidelines ? spec.guidelines : spec.topic).slice(0, 1024);
    if (type === ChannelType.GuildForum && spec.guidelines) opts.topic = spec.guidelines.slice(0, 4096);
    if (spec.slowmode && !isVoice(type)) opts.rateLimitPerUser = Math.min(21600, spec.slowmode);
    if (type === ChannelType.GuildForum && spec.post_slowmode) opts.rateLimitPerUser = Math.min(21600, spec.post_slowmode);
    if (spec.user_limit && isVoice(type)) opts.userLimit = Math.min(99, spec.user_limit);
    if (type === ChannelType.GuildForum && spec.forum_tags?.length) opts.availableTags = spec.forum_tags.slice(0, 20).map((t) => ({ name: String(t).slice(0, 20) }));
    let ch = guild.channels.cache.find((c) => c.name === spec.name && c.parentId === (parent?.id ?? null)) || findChannel(guild, spec.name);
    try {
      if (ch && ch.type !== type) ch = null; // different kind with same name: create a new one
      if (!ch) ch = await guild.channels.create(opts);
      else {
        const edit = { ...opts };
        delete edit.type;
        if (hasOwn === undefined && false) delete edit.permissionOverwrites;
        await ch.edit(edit);
      }
    } catch (err) { warnings.add(`channel ${spec.name}: ${err.message}`); return null; }
    return ch;
  };

  let catIndex = 0;
  for (const cat of bp.categories || []) {
    const key = `cat:${cat.name}`;
    let parent = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && (c.name === cat.name || norm(c.name) === norm(cat.name)));
    const catOw = buildOverwrites(guild, cat, ChannelType.GuildCategory, warnings);
    try {
      if (!parent) parent = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, permissionOverwrites: catOw, reason: "blueprint" });
      else await parent.edit({ permissionOverwrites: catOw });
      await parent.setPosition(catIndex++).catch(() => {});
    } catch (err) { warnings.add(`category ${cat.name}: ${err.message}`); continue; }
    let pos = 0;
    for (const spec of cat.channels || []) {
      const ch = await ensureChannel(spec, parent, { view: cat.view, send: cat.send, overwrites: cat.overwrites });
      if (ch) await ch.setPosition(pos++).catch(() => {});
      await progress(`channel ${spec.name}`);
    }
    mark(key);
  }

  // ---------- PHASE 3: server settings (+ Community) ----------
  await onProgress("Phase 3/6 — server settings");
  const s = bp.server || {};
  const VL = { none: GuildVerificationLevel.None, low: GuildVerificationLevel.Low, medium: GuildVerificationLevel.Medium, high: GuildVerificationLevel.High, very_high: GuildVerificationLevel.VeryHigh, highest: GuildVerificationLevel.VeryHigh };
  const EF = { disabled: GuildExplicitContentFilter.Disabled, members_without_roles: GuildExplicitContentFilter.MembersWithoutRoles, all_members: GuildExplicitContentFilter.AllMembers };
  const edit = {};
  if (s.verification_level && VL[s.verification_level] !== undefined) edit.verificationLevel = VL[s.verification_level];
  if (s.explicit_content_filter && EF[s.explicit_content_filter] !== undefined) edit.explicitContentFilter = EF[s.explicit_content_filter];
  if (s.default_notifications) edit.defaultMessageNotifications = s.default_notifications === "all_messages" ? GuildDefaultMessageNotifications.AllMessages : GuildDefaultMessageNotifications.OnlyMentions;
  const afk = findChannel(guild, s.afk_channel, [ChannelType.GuildVoice]);
  if (afk) { edit.afkChannel = afk; edit.afkTimeout = [60, 300, 900, 1800, 3600].includes(s.afk_timeout) ? s.afk_timeout : 900; }
  const sys = findChannel(guild, s.system_channel, [ChannelType.GuildText]);
  if (sys) edit.systemChannel = sys;
  try { if (Object.keys(edit).length) await guild.edit({ ...edit, reason: "blueprint" }); } catch (err) { warnings.add(`server settings: ${err.message}`); }
  if (s.enable_community && !guild.features.includes("COMMUNITY")) {
    const rules = findChannel(guild, s.rules_channel, [ChannelType.GuildText]);
    const updates = findChannel(guild, s.updates_channel, [ChannelType.GuildText]);
    try {
      if (!rules || !updates) throw new Error("rules/updates channel missing");
      await guild.edit({ features: [...guild.features, "COMMUNITY"], rulesChannel: rules, publicUpdatesChannel: updates, explicitContentFilter: GuildExplicitContentFilter.AllMembers, verificationLevel: Math.max(GuildVerificationLevel.Low, edit.verificationLevel ?? guild.verificationLevel), reason: "blueprint" });
      await guild.fetch();
    } catch (err) { warnings.add(`enable Community: ${err.message}`); }
  } else if (guild.features.includes("COMMUNITY")) {
    const rules = findChannel(guild, s.rules_channel, [ChannelType.GuildText]);
    const updates = findChannel(guild, s.updates_channel, [ChannelType.GuildText]);
    if (rules || updates) await guild.edit({ rulesChannel: rules || undefined, publicUpdatesChannel: updates || undefined }).catch((e) => warnings.add(`rules/updates channel: ${e.message}`));
  }
  // Channels that needed Community (stage / announcement / forum)
  for (const d of deferred) {
    const ch = await ensureChannel(d.spec, d.parent, d.inherit);
    const idx = (bp.categories.find((c) => norm(c.name) === norm(d.parent?.name))?.channels || []).findIndex((x) => x.name === d.spec.name);
    if (ch && idx >= 0) await ch.setPosition(idx).catch(() => {});
  }
  // AFK channel may only exist now
  if (!afk && s.afk_channel) {
    const a2 = findChannel(guild, s.afk_channel, [ChannelType.GuildVoice]);
    if (a2) await guild.edit({ afkChannel: a2, afkTimeout: [60, 300, 900, 1800, 3600].includes(s.afk_timeout) ? s.afk_timeout : 900 }).catch(() => {});
  }

  // ---------- PHASE 4: AutoMod ----------
  await onProgress("Phase 4/6 — AutoMod");
  const TRIG = { keyword: 1, spam: 3, preset: 4, mention_spam: 5 };
  const PRESET = { profanity: 1, sexual_content: 2, slurs: 3 };
  const existing = await guild.autoModerationRules.fetch().catch(() => null);
  for (const a of bp.automod || []) {
    const triggerType = TRIG[a.trigger];
    if (!triggerType) continue;
    const actions = [];
    if ((a.actions || ["block"]).includes("block")) actions.push({ type: 1, metadata: {} });
    const alertCh = findChannel(guild, a.alert_channel, [ChannelType.GuildText]);
    if ((a.actions || []).includes("alert") && alertCh) actions.push({ type: 2, metadata: { channel: alertCh.id } });
    if ((a.actions || []).includes("timeout") && (triggerType === 1 || triggerType === 5)) actions.push({ type: 3, metadata: { durationSeconds: Math.min(2419200, a.timeout_seconds || 600) } });
    if (!actions.length) actions.push({ type: 1, metadata: {} });
    const triggerMetadata = {};
    if (triggerType === 1) { triggerMetadata.keywordFilter = (a.keywords || []).slice(0, 1000); triggerMetadata.regexPatterns = (a.regex || []).slice(0, 10); triggerMetadata.allowList = (a.allow || []).slice(0, 100); }
    if (triggerType === 4) { triggerMetadata.presets = (a.presets || ["slurs"]).map((p) => PRESET[p]).filter(Boolean); triggerMetadata.allowList = (a.allow || []).slice(0, 1000); }
    if (triggerType === 5) { triggerMetadata.mentionTotalLimit = Math.min(50, a.mention_limit || 5); triggerMetadata.mentionRaidProtectionEnabled = true; }
    const data = {
      name: a.name.slice(0, 100), eventType: 1, triggerType, triggerMetadata, actions, enabled: true,
      exemptRoles: (a.exempt_roles || []).map((n) => findRole(guild, n)?.id).filter(Boolean),
      exemptChannels: (a.exempt_channels || []).map((n) => findChannel(guild, n)?.id).filter(Boolean),
      reason: "blueprint",
    };
    try {
      const same = existing?.find((r) => r.name === data.name) || (triggerType !== 1 ? existing?.find((r) => r.triggerType === triggerType) : null);
      let edited = false;
      if (same) {
        // trigger type can't be changed on an existing rule; if the edit fails (e.g. Discord's default rule), create our own
        const { triggerType: _t, eventType: _e, ...editData } = data;
        edited = await same.edit(editData).then(() => true, () => false);
      }
      if (!edited) await guild.autoModerationRules.create(data);
    } catch (err) { warnings.add(`AutoMod "${a.name}": ${err.message}`); }
  }

  // ---------- PHASE 5: feature settings & systems ----------
  await onProgress("Phase 5/6 — systems (settings, tickets, ranks, panels…)");
  const { executeFeatureTool } = await import("./aiTools.js");
  const run = async (tool, params, label) => {
    const r = await executeFeatureTool(guild, tool, params).catch((e) => ({ success: false, message: e.message }));
    if (r && !r.success) warnings.add(`${label}: ${r.message}`);
    else if (r && /Problems?:/.test(r.message)) warnings.add(`${label}: ${r.message.split(/Problems?:/)[1].trim()}`);
  };
  const settings = { ...(bp.settings || {}) };
  if (bp.member_role && !settings.verify_role) settings.verify_role = bp.member_role;
  if (bp.staff_roles?.length && !settings.staff_role) settings.staff_role = bp.staff_roles[bp.staff_roles.length - 1];
  if (bp.leadership_roles?.length && !settings.leadership_role) settings.leadership_role = bp.leadership_roles[bp.leadership_roles.length - 1];
  if (bp.staff_roles?.length && !settings.staff_roles) settings.staff_roles = bp.staff_roles.join(",");
  if (bp.leadership_roles?.length && !settings.leadership_roles) settings.leadership_roles = bp.leadership_roles.join(",");
  if (bp.ticket_staff_roles?.length && !settings.ticket_staff_roles) settings.ticket_staff_roles = bp.ticket_staff_roles.join(",");
  if (Object.keys(settings).length) await run("configure_server", { settings }, "settings");
  if (bp.ticket_types?.length) await run("set_ticket_categories", { categories: bp.ticket_types }, "ticket types");
  if (bp.rank_roles?.length) await run("set_rank_roles", { ranks: bp.rank_roles, stack: !!bp.rank_stack }, "rank roles");
  if (bp.roblox) await run("configure_roblox", { achievements: (bp.roblox.achievements || []).filter((a) => a.badge_id), leaderboards: bp.roblox.leaderboards }, "roblox");
  for (const c of bp.counters || []) {
    const k = `counter:${c.kind}:${c.template}`;
    if (done(k)) continue;
    await run("create_counter_channel", c, `counter ${c.template}`);
    mark(k);
  }
  for (const sc of bp.schedules || []) {
    const k = `sched:${sc.every}:${sc.day}:${sc.time}:${sc.channel}:${sc.kind}`;
    if (done(k)) continue;
    await run("add_scheduled_post", sc, `schedule ${sc.time}`);
    mark(k);
  }

  // ---------- PHASE 6: messages & panels ----------
  await onProgress("Phase 6/6 — starter messages & panels");
  for (const m of bp.messages || []) {
    const k = `msg:${m.channel}:${m.title}`;
    if (done(k)) continue;
    const ch = findChannel(guild, m.channel, [ChannelType.GuildText, ChannelType.GuildAnnouncement]);
    if (!ch) { warnings.add(`message channel not found: ${m.channel}`); continue; }
    try {
      const desc = String(m.description || "").replace(/@(everyone|here)/g, "@​$1");
      const parts = desc.match(/[\s\S]{1,4000}(\n|$)/g) || [desc];
      let first = null;
      for (let i = 0; i < parts.length; i++) {
        const e = baseEmbed(COLORS.dark).setDescription(parts[i]);
        if (i === 0 && m.title) e.setTitle(m.title);
        if (i === parts.length - 1 && m.fields?.length) e.addFields(m.fields.slice(0, 25).map((f) => ({ name: f.name, value: f.value })));
        e.data.timestamp = undefined;
        const sent = await ch.send({ embeds: [e], allowedMentions: { parse: [] } });
        first ??= sent;
      }
      if (m.pin !== false && first) await first.pin().catch(() => {});
      mark(k);
    } catch (err) { warnings.add(`message in ${m.channel}: ${err.message}`); }
    await progress(`message ${m.channel}`);
  }
  for (const p of bp.self_role_panels || []) {
    const k = `rolepanel:${p.channel}:${p.title}`;
    if (done(k)) continue;
    await run("post_feature_panel", { type: "roles", channel: p.channel, mode: p.mode || "dropdown", title: p.title, description: p.description, single_choice: !!p.single_choice, roles: p.roles }, `role panel ${p.title}`);
    mark(k);
  }
  for (const p of bp.panels || []) {
    const k = `panel:${p.type}:${p.channel}`;
    if (done(k)) continue;
    await run("post_feature_panel", { type: p.type, channel: p.channel, role: p.type === "verify" ? bp.member_role : undefined }, `${p.type} panel`);
    mark(k);
  }
  for (const s2 of bp.stickies || []) {
    const k = `sticky:${s2.channel}`;
    if (done(k)) continue;
    await run("set_sticky_message", { channel: s2.channel, text: s2.text, every: s2.every }, `sticky ${s2.channel}`);
    mark(k);
  }

  st.lastRun = Date.now();
  st.log = [...warnings];
  saveFeatures();
  return { warnings: [...warnings] };
}
