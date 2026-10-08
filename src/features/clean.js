import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from "discord.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import {
  featureData, saveFeatures, resolveChannel, resolveChannels, isStaff, settingOn, settingNum,
} from "./config.js";
import { getSettings } from "../storage/serverSettings.js";

// ===================== WRONG-CHANNEL NUDGES =====================
// Commands that make sense anywhere (or are channel-specific themselves)
const ANYWHERE = new Set(["help", "afk", "suggest", "ticket", "invite", "kick", "leave", "warn", "warnings", "unwarn", "poll", "giveaway", "birthday", "link", "playtest", "patchnotes", "raidmode", "raid", "xp", "whois", "suggestion"]);

// Returns true if the command was blocked (message deleted + user DMed).
export async function enforceBotChannel(message, command) {
  if (!message.guild) return false;
  if (!settingOn(message.guild.id, "enforce_bot_channel")) return false;
  const botChannel = resolveChannel(message.guild, "bot_commands_channel", ["bot-commands", "commands", "bot-cmds"]);
  if (!botChannel || message.channelId === botChannel.id) return false;
  if (message.channel.isThread?.() && message.channel.parentId === botChannel.id) return false;
  if (command.adminOnly || command.category === "admin" || command.category === "mod" || command.category === "rooms" || ANYWHERE.has(command.name)) return false;
  if (isStaff(message.member)) return false;
  // Per-server exceptions, e.g. "rank:rank-ups,level:rank-ups"
  const ex = (getSettings(message.guild.id).bot_command_exceptions || "").split(",").map((x) => x.trim().split(":"));
  const chName = message.channel.name.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (ex.some(([cmd, ch]) => cmd === command.name && ch && chName.includes(ch.toLowerCase().replace(/[^a-z0-9-]/g, "")))) return false;
  if (featureData(message.guild.id, "tickets", { open: {} }).open?.[message.channelId]) return false;
  const { getRoom } = await import("../storage/privateRooms.js");
  if (getRoom(message.channelId)) return false;
  const delay = settingNum(message.guild.id, "wrong_channel_delay", 3);
  setTimeout(() => message.delete().catch(() => {}), Math.max(0, delay) * 1000);
  await message.author.send(`Use <#${botChannel.id}> for bot commands in **${message.guild.name}**.`).catch(() => {});
  return true;
}

// ===================== AUTO-THREADS & MEDIA-ONLY =====================
const DEFAULT_MEDIA_DOMAINS = ["youtube.com", "youtu.be", "tiktok.com", "medal.tv", "streamable.com", "imgur.com", "roblox.com", "twitch.tv", "gyazo.com"];

export async function handleChannelRules(message) {
  if (!message.guild || message.author.bot || message.channel.isThread?.()) return false;
  const gid = message.guild.id;
  const s = getSettings(gid);

  const mediaOnly = resolveChannels(message.guild, "media_only_channels", ["fan-art", "fanart", "clips", "screenshots", "media"]);
  if (mediaOnly.some((c) => c.id === message.channelId) && !isStaff(message.member)) {
    const domains = s.media_link_domains ? s.media_link_domains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean) : DEFAULT_MEDIA_DOMAINS;
    const hosts = [...(message.content || "").matchAll(/https?:\/\/([^\s/]+)/gi)].map((m) => m[1].toLowerCase().replace(/^www\./, ""));
    const okLink = hosts.some((h) => domains.some((d) => h === d || h.endsWith("." + d)));
    const hasMedia = message.attachments.size > 0 || message.stickers.size > 0 || okLink;
    if (!hasMedia) {
      await message.delete().catch(() => {});
      await message.author.send(`<#${message.channelId}> in **${message.guild.name}** is media only — chat in the post's thread.`).catch(() => {});
      return true;
    }
  }

  const autothread = resolveChannels(message.guild, "autothread_channels", ["looking-for-group", "lfg"]);
  if (autothread.some((c) => c.id === message.channelId) && s.autothread_enabled !== "false") {
    const len = settingNum(gid, "autothread_name_length", 40);
    const base = (message.content || "").replace(/<[@#&!:a-z0-9]+>/gi, "").replace(/https?:\/\/\S+/g, "").replace(/\n/g, " ").trim();
    const name = (base.slice(0, len) || `${message.member?.displayName || message.author.username}'s post`);
    await message.startThread({ name, autoArchiveDuration: 1440 }).catch(() => {});
  }
  return false;
}

// ===================== TICKET ACTIVITY + INACTIVITY =====================
export function touchTicket(message) {
  if (!message.guild) return;
  const tk = featureData(message.guild.id, "tickets", { counter: 0, open: {} }).open[message.channelId];
  if (!tk || message.author.bot) return;
  if (message.author.id === tk.ownerId) {
    tk.lastOwnerActivity = Date.now();
    tk.warned = false;
  } else if (isStaff(message.member)) {
    tk.firstStaffReplyAt ??= Date.now();
    tk.lastStaffReplyAt = Date.now();
    tk.claimReminded = false;
  }
  tk.lastActivity = Date.now();
  saveFeatures();
}

// Opener silent for 48h → warning; 72h → close. Claimed with no staff reply for 24h → ping the claimer once.
export async function checkInactiveTickets(client) {
  const { closeTicket } = await import("./tickets.js");
  for (const guild of client.guilds.cache.values()) {
    const tickets = featureData(guild.id, "tickets", { counter: 0, open: {} });
    const warnH = settingNum(guild.id, "ticket_inactive_hours", 48);
    const claimH = settingNum(guild.id, "ticket_claim_reminder_hours", 24);
    for (const [cid, tk] of Object.entries(tickets.open)) {
      const ch = guild.channels.cache.get(cid);
      if (!ch) { delete tickets.open[cid]; saveFeatures(); continue; }
      if (warnH) {
        const idle = Date.now() - (tk.lastOwnerActivity || tk.openedAt);
        if (idle > warnH * 1.5 * 3600000) {
          await ch.send({ embeds: [baseEmbed(COLORS.danger).setDescription(`🔒 Closing this ticket — no reply for ${Math.round(warnH * 1.5)} hours.`)] }).catch(() => {});
          await closeTicket(ch, client.user, `No reply from the opener for ${Math.round(warnH * 1.5)}h`);
          continue;
        }
        if (idle > warnH * 3600000 && !tk.warned) {
          tk.warned = true;
          saveFeatures();
          await ch.send({ content: `<@${tk.ownerId}>`, embeds: [baseEmbed(COLORS.warning).setDescription(`This ticket closes in ${Math.round(warnH / 2)} h if there's no reply.`)], allowedMentions: { users: [tk.ownerId] } }).catch(() => {});
        }
      }
      if (claimH && tk.claimedBy && !tk.claimReminded && Date.now() - (tk.lastStaffReplyAt || tk.claimedAt || tk.openedAt) > claimH * 3600000) {
        tk.claimReminded = true;
        saveFeatures();
        await ch.send({ content: `<@${tk.claimedBy}> reminder: no staff reply here for ${claimH} h.`, allowedMentions: { users: [tk.claimedBy] } }).catch(() => {});
      }
    }
  }
}

// ===================== FORUMS =====================
export const tagNames = (thread) => (thread.appliedTags || []).map((id) => thread.parent?.availableTags?.find((t) => t.id === id)?.name?.toLowerCase() || "");

export function bugForums(guild) {
  return resolveChannels(guild, "bug_forums", ["bug-reports", "test-bugs", "bugs"]).filter((c) => c.type === ChannelType.GuildForum);
}
export function suggestionForum(guild) {
  return resolveChannels(guild, "suggestion_forum", ["suggestions"]).find((c) => c.type === ChannelType.GuildForum) || null;
}
function duplicateForums(guild) {
  return resolveChannels(guild, "duplicate_forums", ["suggestions", "bug-reports", "test-bugs"]).filter((c) => c.type === ChannelType.GuildForum);
}

// When a tag was first applied (thread id → { tag: timestamp })
export function recordTagTimes(oldThread, newThread) {
  const before = new Set(tagNames(oldThread));
  const added = tagNames(newThread).filter((t) => !before.has(t));
  if (!added.length) return;
  const times = featureData(newThread.guild.id, "forumTagTimes", {});
  times[newThread.id] ??= {};
  for (const t of added) times[newThread.id][t] = Date.now();
  saveFeatures();
}
const tagAge = (guildId, threadId, re) => {
  const times = featureData(guildId, "forumTagTimes", {})[threadId] || {};
  const hit = Object.entries(times).find(([t]) => re.test(t));
  return hit ? Date.now() - hit[1] : null;
};

export async function tidyForums(client) {
  for (const guild of client.guilds.cache.values()) {
    const bugs = bugForums(guild);
    const sug = suggestionForum(guild);
    const idleDays = settingNum(guild.id, "forum_inactive_days", 30);
    const deniedDays = settingNum(guild.id, "suggestion_denied_archive_days", 3);
    const acceptedDays = settingNum(guild.id, "suggestion_accepted_lock_days", 14);
    for (const forum of [...bugs, sug].filter(Boolean)) {
      const active = await forum.threads.fetchActive().catch(() => null);
      for (const thread of active?.threads.values() || []) {
        if (thread.parentId !== forum.id) continue;
        const tags = tagNames(thread);
        const lastMsg = thread.lastMessageId ? await thread.messages.fetch(thread.lastMessageId).catch(() => null) : null;
        const idle = Date.now() - (lastMsg?.createdTimestamp || thread.createdTimestamp);
        const day = 86400000;
        const close = async (note) => { if (note) await thread.send(note).catch(() => {}); await thread.setLocked(true).catch(() => {}); await thread.setArchived(true).catch(() => {}); };
        if (bugs.includes(forum) && tags.some((t) => /fixed|can'?t reproduce|cannot reproduce|solved|resolved/.test(t))) {
          const age = tagAge(guild.id, thread.id, /fixed|reproduce|solved|resolved/) ?? idle;
          if (age > 7 * day) { await close("🔒 Closing this report (resolved 7+ days ago)."); continue; }
        }
        if (forum === sug && tags.some((t) => /denied|rejected/.test(t))) {
          if (!thread.locked) await thread.setLocked(true).catch(() => {});
          const age = tagAge(guild.id, thread.id, /denied|rejected/) ?? idle;
          if (age > deniedDays * day) { await thread.setArchived(true).catch(() => {}); continue; }
        }
        if (forum === sug && tags.some((t) => /accepted/.test(t))) {
          const age = tagAge(guild.id, thread.id, /accepted/) ?? idle;
          if (age > acceptedDays * day && !thread.locked) await thread.setLocked(true).catch(() => {});
        }
        if (idleDays && idle > idleDays * day) await thread.setArchived(true).catch(() => {});
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

// New post in a duplicate-checked forum → show up to 3 similar posts, with "this is a duplicate" buttons for the author.
export async function handleNewForumThread(thread) {
  const guild = thread.guild;
  if (!duplicateForums(guild).some((f) => f.id === thread.parentId)) return;
  await new Promise((r) => setTimeout(r, 2500)); // let the starter message arrive
  const starter = await thread.fetchStarterMessage().catch(() => null);
  const text = `${thread.name} ${starter?.content || ""}`;
  const forum = thread.parent;
  const pool = [];
  const active = await forum.threads.fetchActive().catch(() => null);
  if (active) pool.push(...active.threads.values());
  const archived = await forum.threads.fetchArchived({ limit: 100 }).catch(() => null);
  if (archived) pool.push(...archived.threads.values());
  const scored = [];
  for (const t of pool) {
    if (t.id === thread.id || t.parentId !== forum.id) continue;
    let score = similarity(text, t.name);
    if (score < 0.5 && score >= 0.25) {
      const st = await t.fetchStarterMessage().catch(() => null);
      score = Math.max(score, similarity(text, `${t.name} ${st?.content || ""}`));
    }
    if (score >= 0.45) scored.push({ t, score });
  }
  const matches = scored.sort((a, b) => b.score - a.score).slice(0, 3);
  if (!matches.length) return;
  const row = new ActionRowBuilder().addComponents(matches.map(({ t }, i) =>
    new ButtonBuilder().setCustomId(`dup:${thread.id}:${t.id}`).setLabel(`Duplicate of #${i + 1}`).setStyle(ButtonStyle.Secondary)));
  await thread.send({
    embeds: [baseEmbed(COLORS.dark).setTitle("🔎 Is this the same as…?")
      .setDescription(matches.map(({ t }, i) => `**#${i + 1}** <#${t.id}>`).join("\n") + "\n\nIf one matches, press its button and add your info there instead.")],
    components: [row],
  }).catch(() => {});
}

export async function handleDuplicateButton(interaction) {
  const [, threadId, originalId] = interaction.customId.split(":");
  const thread = interaction.guild.channels.cache.get(threadId) || await interaction.guild.channels.fetch(threadId).catch(() => null);
  if (!thread) return interaction.reply({ content: "Post not found.", ephemeral: true });
  if (interaction.user.id !== thread.ownerId && !isStaff(interaction.member)) return interaction.reply({ content: "Only the author or staff can mark this as a duplicate.", ephemeral: true });
  await interaction.update({ components: [] });
  await thread.send(`🔁 Closed as a duplicate of <#${originalId}>.`).catch(() => {});
  await thread.setLocked(true).catch(() => {});
  await thread.setArchived(true).catch(() => {});
}

export async function handleForumThreadUpdate(oldThread, newThread) {
  recordTagTimes(oldThread, newThread);
  const { handleBugTagChange } = await import("./bugs.js");
  await handleBugTagChange(oldThread, newThread);
  const sug = suggestionForum(newThread.guild);
  if (sug && newThread.parentId === sug.id) {
    const before = tagNames(oldThread), after = tagNames(newThread);
    if (after.some((t) => /denied|rejected/.test(t)) && !before.some((t) => /denied|rejected/.test(t))) await newThread.setLocked(true).catch(() => {});
  }
}
