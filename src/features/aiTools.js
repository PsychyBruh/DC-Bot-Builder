// Tools that let the !chat AI configure every server feature from a plain-English prompt.
import { ChannelType } from "discord.js";
import { SETTING_KEYS, describeSettings } from "./settingsKeys.js";
import { getSettings, setSetting, removeSetting } from "../storage/serverSettings.js";
import { featureData, saveFeatures, canManageRole } from "./config.js";

const S = (description, extra = {}) => ({ type: "string", description, ...extra });

export const FEATURE_TOOLS = [
  {
    name: "build_server_blueprint",
    description: "For a long full-server spec (many roles/channels/systems): turn it into a saved build plan in one step. The user then reviews it and types !blueprint build. Pass the user's full spec text unchanged.",
    input_schema: { type: "object", properties: { request: S("The user's complete server specification") }, required: ["request"] },
  },
  {
    name: "configure_server",
    description: `Set or clear per-server feature settings (channels, roles, thresholds, toggles). Channels/roles can be given by name, #mention or ID. Pass value "" to clear. Settings:\n${describeSettings()}`,
    input_schema: {
      type: "object",
      properties: {
        settings: { type: "object", description: "Map of setting key → value, e.g. {\"verify_role\":\"Member\",\"mod_log_channel\":\"mod-log\",\"raid_join_threshold\":\"10\"}", additionalProperties: { type: "string" } },
      },
      required: ["settings"],
    },
  },
  {
    name: "get_server_config",
    description: "Show this server's current feature settings and configured panels/ranks/schedules, so you can see what's already set up.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "post_feature_panel",
    description: "Post an interactive panel: 'verify' (Verify button → role), 'tickets' (ticket category dropdown), 'applications' (apply buttons → forms), or 'roles' (self-role panel with buttons, a dropdown, or reactions).",
    input_schema: {
      type: "object",
      properties: {
        type: S("verify | tickets | applications | roles", { enum: ["verify", "tickets", "applications", "roles"] }),
        channel: S("Channel name or ID to post in"),
        role: S("verify only: role to give (name or ID)"),
        mode: S("roles only: buttons | dropdown | reactions", { enum: ["buttons", "dropdown", "reactions"] }),
        title: S("roles only: panel title, e.g. 'Platform'"),
        description: S("roles only: optional text above the list"),
        single_choice: { type: "boolean", description: "roles only: members can only hold one role from this panel (e.g. region)" },
        roles: { type: "array", description: "roles only: roles on the panel (self/ping/cosmetic roles only — roles with mod/admin permissions are refused)", items: { type: "object", properties: { role: S("Role name or ID"), emoji: S("Emoji (required for reactions mode)"), description: S("Optional one-line description (dropdown)") }, required: ["role"] } },
      },
      required: ["type", "channel"],
    },
  },
  {
    name: "set_ticket_categories",
    description: "Replace this server's ticket categories (shown in the ticket dropdown). Re-post the ticket panel afterwards.",
    input_schema: {
      type: "object",
      properties: {
        categories: { type: "array", items: { type: "object", properties: {
          key: S("short id, e.g. support"), label: S("Display name"), emoji: S("Emoji"), description: S("One-line description"), prompt: S("Question shown in the form, e.g. 'What do you need help with?'"),
          viewer_roles: { type: "array", items: { type: "string" }, description: "Extra roles that see this ticket type" },
          open_role: S("Role given while this ticket is open (e.g. Tester Applicant)"),
          form: { type: "array", maxItems: 5, items: { type: "object", properties: { question: S("max 45 chars"), long: { type: "boolean" } } }, description: "Application form questions (shown instead of prompt)" },
          review_channel: S("Applications: channel that gets an Accept/Deny copy"),
          review_roles: { type: "array", items: { type: "string" } }, accept_add_roles: { type: "array", items: { type: "string" } },
          accept_remove_roles: { type: "array", items: { type: "string" } }, deny_remove_roles: { type: "array", items: { type: "string" } },
          requires_link: { type: "boolean", description: "Needs a linked Roblox account" },
        }, required: ["key", "label"] } },
      },
      required: ["categories"],
    },
  },
  {
    name: "set_application_forms",
    description: "Replace this server's application forms (max 5 questions each). Re-post the applications panel afterwards.",
    input_schema: {
      type: "object",
      properties: {
        forms: { type: "array", items: { type: "object", properties: {
          key: S("short id, e.g. staff"), label: S("Display name"), emoji: S("Emoji"),
          accept_role: S("Role given when accepted (name or ID), optional"),
          questions: { type: "array", maxItems: 5, items: { type: "object", properties: { question: S("Question (max 45 chars)"), long: { type: "boolean", description: "Paragraph answer instead of one line" } }, required: ["question"] } },
        }, required: ["key", "label", "questions"] } },
      },
      required: ["forms"],
    },
  },
  {
    name: "set_rank_roles",
    description: "Set the XP rank ladder: roles given automatically at levels (replaces the current list). Optionally coins and a perk description per rank.",
    input_schema: {
      type: "object",
      properties: {
        ranks: { type: "array", items: { type: "object", properties: { level: { type: "integer" }, role: S("Role name or ID"), coins: { type: "integer" }, perk: S("Short perk text shown on rank-up") }, required: ["level", "role"] } },
        stack: { type: "boolean", description: "Keep lower rank roles too (default false = only the highest)" },
      },
      required: ["ranks"],
    },
  },
  {
    name: "set_sticky_message",
    description: "Keep a note at the bottom of a channel (re-posted after new messages). Empty text removes it.",
    input_schema: { type: "object", properties: { channel: S("Channel name or ID"), text: S("Sticky text, or empty to remove"), every: { type: "integer", description: "Re-post after this many messages (default 1)" } }, required: ["channel", "text"] },
  },
  {
    name: "add_scheduled_post",
    description: "Recurring post (UTC). kind 'post' posts the message; kind 'sotw' runs Screenshot of the Week (top screenshots → poll).",
    input_schema: {
      type: "object",
      properties: {
        every: S("daily | weekly | monthly", { enum: ["daily", "weekly", "monthly"] }),
        day: S("weekly: mon..sun; monthly: 1-28"),
        time: S("HH:MM UTC"),
        channel: S("Channel name or ID"),
        message: S("Text to post (kind=post)"),
        ping_role: S("Optional role to ping"),
        ping_roles: { type: "array", items: { type: "string" }, description: "Roles to ping" },
        kind: S("post | sotw | repost_latest", { enum: ["post", "sotw", "repost_latest"] }),
        source_channel: S("repost_latest: channel whose newest message is re-posted"),
      },
      required: ["every", "time", "channel"],
    },
  },
  {
    name: "create_counter_channel",
    description: "Create a locked voice channel that shows a live count, e.g. '👥 Members: {count}'.",
    input_schema: { type: "object", properties: { kind: S("members | humans | bots | boosts | role | roles", { enum: ["members", "humans", "bots", "boosts", "role", "roles"] }), template: S("Name with {count}"), role: S("kind=role: role to count"), roles: { type: "array", items: { type: "string" }, description: "kind=roles: count members with ANY of these roles" }, category: S("Category to put it in") }, required: ["kind"] },
  },
  {
    name: "configure_roblox",
    description: "Roblox features: achievement roles (badge → role for linked members) and in-game leaderboards (OrderedDataStore name, ascending for fastest times, format 'time' for ms values). Also set roblox_universe_id via configure_server.",
    input_schema: {
      type: "object",
      properties: {
        achievements: { type: "array", items: { type: "object", properties: { badge_id: S("Roblox badge ID"), role: S("Role name or ID") }, required: ["badge_id", "role"] } },
        leaderboards: { type: "array", items: { type: "object", properties: { store: S("OrderedDataStore name"), title: S("Display title"), ascending: { type: "boolean" }, format: S("number | time") }, required: ["store"] } },
      },
    },
  },
];

const NAMES = new Set(FEATURE_TOOLS.map((t) => t.name));
export const isFeatureTool = (name) => NAMES.has(name);

function findChannel(guild, ref) {
  if (!ref) return null;
  const id = String(ref).replace(/^<#(\d+)>$/, "$1").replace(/^#/, "");
  return guild.channels.cache.get(id) || guild.channels.cache.find((c) => c.name.toLowerCase() === id.toLowerCase())
    || guild.channels.cache.find((c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(id.toLowerCase().replace(/[^a-z0-9]/g, "")));
}
function findRole(guild, ref) {
  if (!ref) return null;
  const id = String(ref).replace(/^<@&(\d+)>$/, "$1").replace(/^@/, "");
  return guild.roles.cache.get(id) || guild.roles.cache.find((r) => r.name.toLowerCase() === id.toLowerCase());
}

const ok = (message) => ({ success: true, message, beforeState: null });
const fail = (message) => ({ success: false, message, beforeState: null });

export async function executeFeatureTool(guild, name, p) {
  switch (name) {
    case "build_server_blueprint": {
      const { generateBlueprint, saveBlueprint, summarize } = await import("./blueprint.js");
      const bp = await generateBlueprint(p.request || "");
      saveBlueprint(guild.id, bp);
      return ok(`Blueprint saved — ${summarize(bp).replace(/\*\*/g, "").replace(/\n/g, " | ")}. Tell the user to review it with \`!blueprint show\` and build it with \`!blueprint build\` (move the bot's role to the top first).`);
    }
    case "configure_server": {
      const done = [], problems = [];
      for (const [key, raw] of Object.entries(p.settings || {})) {
        const def = SETTING_KEYS[key];
        if (!def && !/^app_role_|^invite_role|^ticket_panel|^verify_channel/.test(key)) { problems.push(`unknown key ${key}`); continue; }
        if (raw === "" || raw === null) { removeSetting(guild.id, key); done.push(`${key} cleared`); continue; }
        let value = String(raw);
        if (def?.type === "channel") { const c = findChannel(guild, value); if (!c) { problems.push(`${key}: channel "${value}" not found`); continue; } value = c.id; }
        else if (def?.type === "role") { const r = findRole(guild, value); if (!r) { problems.push(`${key}: role "${value}" not found`); continue; } value = r.id; }
        else if (def?.type === "toggle") value = /^(on|true|yes|enable|enabled|1)$/i.test(value) ? "true" : "false";
        else if (def?.type === "rolelist") { const rs = value.split(",").map((v) => v.trim()).filter(Boolean).map((v) => ({ v, r: findRole(guild, v) })); rs.filter((x) => !x.r).forEach((x) => problems.push(`${key}: role "${x.v}" not found`)); value = rs.filter((x) => x.r).map((x) => x.r.id).join(","); }
        else if (def?.type === "list") value = value.split(/[,\s]+/).map((v) => findChannel(guild, v)?.id || v.replace(/^#/, "")).filter(Boolean).join(",");
        else if (def?.type === "number" && !Number.isFinite(parseFloat(value))) { problems.push(`${key}: not a number`); continue; }
        setSetting(guild.id, key, value);
        done.push(`${key}=${value}`);
      }
      return (done.length ? ok : fail)(`Set: ${done.join(", ") || "nothing"}${problems.length ? ` | Problems: ${problems.join("; ")}` : ""}`);
    }
    case "get_server_config": {
      const s = getSettings(guild.id);
      const ranks = featureData(guild.id, "ranks", { list: [] }).list;
      const out = {
        settings: s,
        rank_roles: ranks.map((r) => ({ level: r.level, role: guild.roles.cache.get(r.roleId)?.name })),
        ticket_categories: Object.keys(featureData(guild.id, "ticketConfig", {}).types || {}),
        application_forms: Object.keys(featureData(guild.id, "appConfig", {}).types || {}),
        stickies: Object.keys(featureData(guild.id, "sticky", {})).map((id) => guild.channels.cache.get(id)?.name),
        schedules: featureData(guild.id, "schedules", []).map((x) => `${x.every} ${x.day || ""} ${x.time} ${x.kind}`),
        counters: featureData(guild.id, "counters", []).length,
      };
      return ok(JSON.stringify(out).slice(0, 3500));
    }
    case "post_feature_panel": {
      const ch = findChannel(guild, p.channel);
      if (!ch?.isTextBased?.()) return fail(`Channel "${p.channel}" not found`);
      if (p.type === "verify") {
        const { postVerifyPanel, verifyRole } = await import("./roles.js");
        const role = p.role ? findRole(guild, p.role) : verifyRole(guild);
        if (!role) return fail("Verify role not found — pass role");
        if (!canManageRole(guild, role)) return fail(`Bot's role must be above ${role.name}`);
        setSetting(guild.id, "verify_role", role.id);
        await postVerifyPanel(ch, role);
        return ok(`Verify panel posted in #${ch.name} (gives ${role.name})`);
      }
      if (p.type === "tickets") { const { postTicketPanel } = await import("./tickets.js"); await postTicketPanel(ch); return ok(`Ticket panel posted in #${ch.name}`); }
      if (p.type === "applications") { const { postApplicationPanel } = await import("./applications.js"); await postApplicationPanel(ch); return ok(`Application panel posted in #${ch.name}`); }
      if (p.type === "roles") {
        const { postSelfRolePanel, isSafeSelfRole } = await import("./roles.js");
        const entries = [], problems = [];
        for (const r of p.roles || []) {
          const role = findRole(guild, r.role);
          if (!role) { problems.push(`role "${r.role}" not found`); continue; }
          if (!canManageRole(guild, role)) { problems.push(`can't manage ${role.name}`); continue; }
          if (!isSafeSelfRole(role)) { problems.push(`${role.name} has mod/admin permissions — refused`); continue; }
          entries.push({ roleId: role.id, emoji: r.emoji || null, label: role.name, description: r.description || null });
        }
        if (!entries.length) return fail(`No usable roles. ${problems.join("; ")}`);
        const mode = p.mode || "buttons";
        if (mode === "reactions" && entries.some((e) => !e.emoji)) return fail("Reactions mode needs an emoji for every role");
        await postSelfRolePanel(ch, { mode, title: p.title || "Pick your roles", description: p.description, exclusive: !!p.single_choice, entries: entries.slice(0, 25) });
        return ok(`${mode} role panel "${p.title}" posted in #${ch.name} with ${entries.length} roles${problems.length ? ` (skipped: ${problems.join("; ")})` : ""}`);
      }
      return fail("Unknown panel type");
    }
    case "set_ticket_categories": {
      const types = {};
      const roleIds = (list) => (list || []).map((n) => findRole(guild, n)?.id).filter(Boolean);
      for (const c of (p.categories || []).slice(0, 25)) {
        const key = String(c.key).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || `t${Object.keys(types).length}`;
        const review = c.review_channel ? findChannel(guild, c.review_channel) : null;
        types[key] = {
          label: c.label.slice(0, 80), emoji: c.emoji || "🎫", desc: (c.description || c.label).slice(0, 100), prompt: (c.prompt || "Describe your request").slice(0, 100),
          viewer_roles: roleIds(c.viewer_roles), open_role: c.open_role ? findRole(guild, c.open_role)?.id || null : null,
          form: (c.form || []).slice(0, 5).map((q, i) => [`q${i}`, String(q.question || q).slice(0, 45), q.long ? "paragraph" : "short"]),
          review_channel: review?.id || null, review_roles: roleIds(c.review_roles),
          accept_add_roles: roleIds(c.accept_add_roles), accept_remove_roles: roleIds(c.accept_remove_roles), deny_remove_roles: roleIds(c.deny_remove_roles),
          requires_link: !!c.requires_link,
        };
      }
      featureData(guild.id, "ticketConfig", {}).types = types;
      saveFeatures();
      return ok(`Ticket categories set: ${Object.values(types).map((t) => t.label).join(", ")}. Re-post the ticket panel to show them.`);
    }
    case "set_application_forms": {
      const types = {};
      for (const f of (p.forms || []).slice(0, 25)) {
        const key = String(f.key).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
        const role = f.accept_role ? findRole(guild, f.accept_role) : null;
        if (role) setSetting(guild.id, `app_role_${key}`, role.id);
        types[key] = { label: f.label.slice(0, 80), emoji: f.emoji || "📝", roleDefaults: [], questions: (f.questions || []).slice(0, 5).map((q, i) => [`q${i}`, q.question.slice(0, 45), q.long ? "paragraph" : "short"]) };
      }
      featureData(guild.id, "appConfig", {}).types = types;
      saveFeatures();
      return ok(`Application forms set: ${Object.values(types).map((t) => t.label).join(", ")}. Re-post the applications panel to show them.`);
    }
    case "set_rank_roles": {
      const cfg = featureData(guild.id, "ranks", { list: [], stack: false });
      const list = [], problems = [];
      for (const r of p.ranks || []) {
        const role = findRole(guild, r.role);
        if (!role) { problems.push(`role "${r.role}" not found`); continue; }
        if (!canManageRole(guild, role)) problems.push(`can't manage ${role.name} (move bot role above it)`);
        list.push({ level: r.level, roleId: role.id, coins: r.coins || 0, perk: r.perk || null });
      }
      cfg.list = list.sort((a, b) => a.level - b.level);
      if (typeof p.stack === "boolean") cfg.stack = p.stack;
      saveFeatures();
      const { syncRanks } = await import("./levels.js");
      syncRanks(guild).catch(() => {});
      return ok(`Rank ladder set (${list.length} ranks), syncing existing members.${problems.length ? ` Problems: ${problems.join("; ")}` : ""}`);
    }
    case "set_sticky_message": {
      const ch = findChannel(guild, p.channel);
      if (!ch) return fail(`Channel "${p.channel}" not found`);
      const { setSticky, removeSticky, postStickyNow } = await import("./sticky.js");
      if (!p.text) { removeSticky(guild.id, ch.id); return ok(`Sticky removed from #${ch.name}`); }
      // Forums can't hold messages — put the text in the post guidelines instead
      if (ch.type === ChannelType.GuildForum) {
        const text = p.text.slice(0, 4096);
        if (!(ch.topic || "").includes(text)) await ch.setTopic([ch.topic, text].filter(Boolean).join("\n\n").slice(0, 4096));
        return ok(`#${ch.name} is a forum, so the text was added to its post guidelines`);
      }
      if (typeof ch.send !== "function") return fail(`#${ch.name} can't hold messages`);
      setSticky(guild.id, ch.id, p.text.slice(0, 3000), p.every || 1);
      await postStickyNow(ch);
      return ok(`Sticky set in #${ch.name}`);
    }
    case "add_scheduled_post": {
      const ch = findChannel(guild, p.channel);
      if (!ch) return fail(`Channel "${p.channel}" not found`);
      if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(p.time || "")) return fail("time must be HH:MM (UTC)");
      const role = p.ping_role ? findRole(guild, p.ping_role) : null;
      const pings = (p.ping_roles || []).map((n) => findRole(guild, n)?.id).filter(Boolean);
      const src = p.source_channel ? findChannel(guild, p.source_channel) : null;
      const { addSchedule } = await import("./automation.js");
      const id = addSchedule(guild.id, { every: p.every, day: p.every === "weekly" ? String(p.day || "sun").slice(0, 3).toLowerCase() : p.day || null, time: p.time, channelId: ch.id, message: p.message || "", ping: role?.id || null, pings, sourceChannelId: src?.id || null, kind: p.kind || "post" });
      return ok(`Scheduled ${id}: ${p.every} ${p.day || ""} ${p.time} UTC in #${ch.name}`);
    }
    case "create_counter_channel": {
      const roleIds = [...(p.role ? [findRole(guild, p.role)?.id] : []), ...(p.roles || []).map((n) => findRole(guild, n)?.id)].filter(Boolean);
      if ((p.kind === "role" || p.kind === "roles") && !roleIds.length) return fail("kind=role/roles needs role(s)");
      const { createCounter } = await import("./automation.js");
      let template = p.template || { members: "👥 Members: {count}", humans: "🙂 Humans: {count}", bots: "🤖 Bots: {count}", boosts: "🚀 Boosts: {count}", role: "Role: {count}", roles: "Roles: {count}" }[p.kind];
      if (!template.includes("{count}")) template += " {count}";
      const ch = await createCounter(guild, p.kind === "roles" ? "role" : p.kind, template.slice(0, 90), roleIds, p.category);
      return ok(`Counter channel created: ${ch.name}`);
    }
    case "configure_roblox": {
      const notes = [];
      if (Array.isArray(p.achievements)) {
        const list = featureData(guild.id, "achievements", []);
        list.length = 0;
        for (const a of p.achievements) {
          const role = findRole(guild, a.role);
          if (!role) { notes.push(`role "${a.role}" not found`); continue; }
          list.push({ badgeId: String(a.badge_id), roleId: role.id });
        }
        notes.push(`${list.length} achievement roles`);
      }
      if (Array.isArray(p.leaderboards)) {
        const lbs = featureData(guild.id, "leaderboards", []);
        lbs.length = 0;
        for (const l of p.leaderboards) lbs.push({ store: l.store, title: l.title || l.store, ascending: !!l.ascending, format: l.format === "time" ? "time" : "number" });
        notes.push(`${lbs.length} leaderboards`);
      }
      saveFeatures();
      return ok(`Roblox configured: ${notes.join(", ") || "nothing"}`);
    }
  }
  return null;
}
