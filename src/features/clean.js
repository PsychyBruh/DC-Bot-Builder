import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import {
  featureData, saveFeatures, resolveChannel, resolveChannels, resolveForum, isStaff, settingOn, settingNum,
} from "./config.js";
import { getSettings } from "../storage/serverSettings.js";

// ===================== WRONG-CHANNEL NUDGES =====================
// Commands that make sense anywhere (or are channel-specific themselves)
const ANYWHERE = new Set(["help", "afk", "suggest", "ticket", "invite", "kick", "leave", "warn", "warnings", "level", "rank", "poll", "giveaway", "remind", "reminder", "birthday", "link"]);

// Returns true if the command was blocked (message deleted + user DMed).
export async function enforceBotChannel(message, command) {
  if (!message.guild) return false;
  if (!settingOn(message.guild.id, "enforce_bot_channel")) return false;
  const botChannel = resolveChannel(message.guild, "bot_commands_channel", ["bot-commands", "commands", "bot-cmds"]);
  if (!botChannel || message.channelId === botChannel.id) return false;
  if (message.channel.isThread?.() && message.channel.parentId === botChannel.id) return false;
  if (command.adminOnly || command.category === "admin" || command.category === "rooms" || ANYWHERE.has(command.name)) return false;
  if (isStaff(message.member)) return false;
  // Ticket channels and private rooms are fine
  if (featureData(message.guild.id, "tickets", { open: {} }).open?.[message.channelId]) return false;
  const { getRoom } = await import("../storage/privateRooms.js");
  if (getRoom(message.channelId)) return false;
  await message.delete().catch(() => {});
  await message.author.send(`👋 Please use bot commands in <#${botChannel.id}> in **${message.guild.name}** — your \`!${command.name}\` was removed from #${message.channel.name}.`).catch(async () => {
    const note = await message.channel.send({ content: `${message.author}, please use bot commands in <#${botChannel.id}>.`, allowedMentions: { users: [message.author.id] } }).catch(() => null);
    if (note) setTimeout(() => note.delete().catch(() => {}), 8000);
  });
  return true;
}

// ===================== AUTO-THREADS & MEDIA-ONLY =====================
export async function handleChannelRules(message) {
  if (!message.guild || message.author.bot || message.channel.isThread?.()) return false;
  const gid = message.guild.id;

  const mediaOnly = resolveChannels(message.guild, "media_only_channels", ["fan-art", "fanart", "clips", "screenshots"]);
  if (mediaOnly.some((c) => c.id === message.channelId) && !isStaff(message.member)) {
    const hasMedia = message.attachments.size > 0 || /https?:\/\//i.test(message.content) || message.stickers.size > 0;
    if (!hasMedia) {
      await message.delete().catch(() => {});
      await message.author.send(`🖼️ <#${message.channelId}> in **${message.guild.name}** is for media only — reply in a post's thread to chat about it.`).catch(() => {});
      return true;
    }
  }

  const autothread = resolveChannels(message.guild, "autothread_channels", ["looking-for-group", "lfg", "media"]);
  if (autothread.some((c) => c.id === message.channelId) && getSettings(gid).autothread_enabled !== "false") {
    const base = (message.content || "").replace(/<[@#&!:a-z0-9]+>/gi, "").replace(/https?:\/\/\S+/g, "").trim();
    const name = (base.slice(0, 60) || `${message.member?.displayName || message.author.username}'s post`).replace(/\n/g, " ");
    await message.startThread({ name, autoArchiveDuration: 1440 }).catch(() => {});
  }
  return false;
}

// ===================== INACTIVE TICKETS =====================
export function touchTicket(message) {
  if (!message.guild) return;
  const tk = featureData(message.guild.id, "tickets", { counter: 0, open: {} }).open[message.channelId];
  if (!tk || message.author.id === message.client.user.id) return;
  tk.lastActivity = Date.now();
  tk.warned = false;
  saveFeatures();
}

export async function checkInactiveTickets(client) {
  const { closeTicket } = await import("./tickets.js");
  for (const guild of client.guilds.cache.values()) {
    const tickets = featureData(guild.id, "tickets", { counter: 0, open: {} });
    const warnH = settingNum(guild.id, "ticket_inactive_hours", 48);
    if (!warnH) continue;
    for (const [cid, tk] of Object.entries(tickets.open)) {
      const ch = guild.channels.cache.get(cid);
      if (!ch) { delete tickets.open[cid]; saveFeatures(); continue; }
      const idle = Date.now() - (tk.lastActivity || tk.openedAt);
      if (idle > warnH * 1.5 * 3600000) {
        await ch.send({ embeds: [baseEmbed(COLORS.danger).setDescription(`🔒 Closing this ticket — no activity for ${Math.round(warnH * 1.5)} hours.`)] }).catch(() => {});
        await closeTicket(ch, client.user, `Inactive for ${Math.round(warnH * 1.5)}h`);
      } else if (idle > warnH * 3600000 && !tk.warned) {
        tk.warned = true;
        saveFeatures();
        await ch.send({ content: `<@${tk.ownerId}>`, embeds: [baseEmbed(COLORS.warning).setDescription(`⏰ No activity for ${warnH} hours. This ticket will close automatically in ${Math.round(warnH / 2)} hours unless someone replies.`)], allowedMentions: { users: [tk.ownerId] } }).catch(() => {});
      }
    }
  }
}

// ===================== FORUMS: tidy-up, duplicates, bug bridge =====================
const tagNames = (thread) => (thread.appliedTags || []).map((id) => thread.parent?.availableTags?.find((t) => t.id === id)?.name?.toLowerCase() || "");

function bugForum(guild) { return resolveForum(guild, "bug_forum", ["bug-reports", "bugs", "bug-report"]); }
function suggestionForum(guild) { return resolveForum(guild, "suggestion_forum", ["suggestions", "suggestion"]); }

export async function tidyForums(client) {
  for (const guild of client.guilds.cache.values()) {
    const bug = bugForum(guild);
    const sug = suggestionForum(guild);
    for (const forum of [bug, sug].filter(Boolean)) {
      const active = await forum.threads.fetchActive().catch(() => null);
      for (const thread of active?.threads.values() || []) {
        const tags = tagNames(thread);
        if (forum === sug && tags.some((t) => /denied|rejected/.test(t))) {
          await thread.setLocked(true).then(() => thread.setArchived(true)).catch(() => {});
        }
        if (forum === bug && tags.some((t) => /solved|fixed|resolved/.test(t))) {
          const last = thread.lastMessageId ? await thread.messages.fetch(thread.lastMessageId).catch(() => null) : null;
          const lastAt = last?.createdTimestamp || thread.createdTimestamp;
          if (Date.now() - lastAt > 7 * 86400000) {
            await thread.send("🔒 Locking this solved report after 7 days of inactivity.").catch(() => {});
            await thread.setLocked(true).then(() => thread.setArchived(true)).catch(() => {});
          }
        }
      }
    }
  }
}

function words(t) { return new Set((t || "").toLowerCase().match(/[a-z0-9]{3,}/g) || []); }
function similarity(a, b) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  return [...A].filter((w) => B.has(w)).length / Math.min(A.size, B.size);
}

// New forum post in the bug/suggestion forum → point at similar existing posts.
export async function handleNewForumThread(thread) {
  const guild = thread.guild;
  const forums = [bugForum(guild), suggestionForum(guild)].filter(Boolean);
  if (!forums.some((f) => f.id === thread.parentId)) return;
  await new Promise((r) => setTimeout(r, 2000)); // let the starter message arrive
  const starter = await thread.fetchStarterMessage().catch(() => null);
  const text = `${thread.name} ${starter?.content || ""}`;
  const forum = thread.parent;
  const pool = [];
  const active = await forum.threads.fetchActive().catch(() => null);
  if (active) pool.push(...active.threads.values());
  const archived = await forum.threads.fetchArchived({ limit: 100 }).catch(() => null);
  if (archived) pool.push(...archived.threads.values());
  const matches = pool
    .filter((t) => t.id !== thread.id)
    .map((t) => ({ t, score: similarity(text, t.name) }))
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (!matches.length) return;
  await thread.send({ embeds: [baseEmbed(COLORS.info).setTitle("🔎 Is this the same as…?")
    .setDescription(matches.map(({ t }) => `• <#${t.id}>`).join("\n") + "\n\nIf one of these matches, please add your info there instead.")] }).catch(() => {});
}

// Tag "Confirmed" added on a bug report → copy to the staff channel (+ GitHub issue if configured).
export async function handleForumThreadUpdate(oldThread, newThread) {
  const guild = newThread.guild;
  const bug = bugForum(guild);
  if (!bug || newThread.parentId !== bug.id) return;
  const before = tagNames(oldThread);
  const after = tagNames(newThread);
  const confirmedNow = after.some((t) => t.includes("confirmed")) && !before.some((t) => t.includes("confirmed"));
  const bridged = featureData(guild.id, "bugBridge", {});
  if (confirmedNow && !bridged[newThread.id]) {
    const starter = await newThread.fetchStarterMessage().catch(() => null);
    const body = starter?.content || "(no description)";
    const images = starter ? [...starter.attachments.values()].map((a) => a.url) : [];
    let issueUrl = null;
    const repo = getSettings(guild.id).github_repo;
    if (repo && process.env.GITHUB_TOKEN) {
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "DC-Bot-Builder" },
          body: JSON.stringify({ title: newThread.name, body: `${body}\n\n${images.map((u) => `![](${u})`).join("\n")}\n\n---\nReported by ${starter?.author?.tag || "unknown"} in Discord: ${newThread.url}`, labels: ["bug", "confirmed"] }),
        });
        if (res.ok) issueUrl = (await res.json()).html_url;
      } catch {}
    }
    const out = resolveChannel(guild, "bug_confirmed_channel", ["confirmed-bugs", "dev-bugs", "bug-triage"]);
    if (out) {
      const e = baseEmbed(COLORS.danger).setTitle(`🐞 Confirmed: ${newThread.name}`.slice(0, 256))
        .setURL(newThread.url).setDescription(body.slice(0, 3500))
        .addFields({ name: "Reporter", value: starter?.author ? `${starter.author}` : "unknown", inline: true }, { name: "Thread", value: `<#${newThread.id}>`, inline: true });
      if (issueUrl) e.addFields({ name: "GitHub", value: issueUrl });
      if (images[0]) e.setImage(images[0]);
      await out.send({ embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
    }
    bridged[newThread.id] = issueUrl || true;
    saveFeatures();
    if (issueUrl) await newThread.send(`📎 Tracked on GitHub: ${issueUrl}`).catch(() => {});
  }
  // Denied suggestion → archive right away
  const sug = suggestionForum(guild);
  if (sug && newThread.parentId === sug.id && after.some((t) => /denied|rejected/.test(t)) && !before.some((t) => /denied|rejected/.test(t))) {
    await newThread.setLocked(true).then(() => newThread.setArchived(true)).catch(() => {});
  }
}
