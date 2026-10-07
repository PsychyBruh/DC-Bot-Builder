import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { featureData, saveFeatures, resolveChannel, isStaff } from "./config.js";
import { getSettings } from "../storage/serverSettings.js";

// ===================== SUGGESTIONS =====================
// featureData "suggestions": { counter, items: { [messageId]: { number, authorId, text, up:[], down:[], status, reason } } }
const STATUS = {
  pending:    { label: "Pending",      color: COLORS.info },
  approved:   { label: "Approved ✅",   color: COLORS.success },
  denied:     { label: "Denied ❌",     color: COLORS.danger },
  considered: { label: "Considering 🤔", color: COLORS.warning },
  implemented:{ label: "Implemented 🚀", color: COLORS.purple },
};

export function suggestionChannel(guild) {
  return resolveChannel(guild, "suggestion_channel", ["suggestions", "suggestion", "ideas"]);
}

function suggestionEmbed(s, author) {
  const st = STATUS[s.status] || STATUS.pending;
  const e = baseEmbed(st.color)
    .setTitle(`💡 Suggestion #${s.number}`)
    .setDescription(s.text)
    .addFields(
      { name: "Votes", value: `👍 ${s.up.length}  ·  👎 ${s.down.length}`, inline: true },
      { name: "Status", value: st.label, inline: true },
    );
  if (author) e.setAuthor({ name: author.tag || author.username, iconURL: author.displayAvatarURL?.() });
  if (s.reason) e.addFields({ name: "Staff response", value: s.reason });
  return e;
}

function suggestionRow(s, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("sg:up").setEmoji("👍").setLabel(String(s.up.length)).setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId("sg:down").setEmoji("👎").setLabel(String(s.down.length)).setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

export async function postSuggestion(guild, author, text) {
  const channel = suggestionChannel(guild);
  if (!channel) return { error: "This server has no suggestions channel set up." };
  const data = featureData(guild.id, "suggestions", { counter: 0, items: {} });
  data.counter += 1;
  const s = { number: data.counter, authorId: author.id, text: text.slice(0, 3500), up: [], down: [], status: "pending", reason: null, at: Date.now() };
  const msg = await channel.send({ embeds: [suggestionEmbed(s, author)], components: [suggestionRow(s)], allowedMentions: { parse: [] } });
  data.items[msg.id] = s;
  saveFeatures();
  if (getSettings(guild.id).suggestion_threads !== "false") {
    await msg.startThread({ name: `Suggestion #${s.number} discussion`.slice(0, 90), autoArchiveDuration: 10080 }).catch(() => {});
  }
  return { message: msg, number: s.number };
}

export async function handleSuggestionVote(interaction) {
  const data = featureData(interaction.guildId, "suggestions", { counter: 0, items: {} });
  const s = data.items[interaction.message.id];
  if (!s) return interaction.reply({ content: "This suggestion is no longer tracked.", ephemeral: true });
  if (s.status !== "pending" && s.status !== "considered") return interaction.reply({ content: "Voting is closed on this suggestion.", ephemeral: true });
  const dir = interaction.customId.split(":")[1];
  const uid = interaction.user.id;
  const mine = dir === "up" ? s.up : s.down;
  const other = dir === "up" ? s.down : s.up;
  if (mine.includes(uid)) mine.splice(mine.indexOf(uid), 1); // click again = remove vote
  else { mine.push(uid); if (other.includes(uid)) other.splice(other.indexOf(uid), 1); }
  saveFeatures();
  const author = await interaction.client.users.fetch(s.authorId).catch(() => null);
  return interaction.update({ embeds: [suggestionEmbed(s, author)], components: [suggestionRow(s)] });
}

// number or message ID → [messageId, suggestion]
export function findSuggestion(guildId, ref) {
  const data = featureData(guildId, "suggestions", { counter: 0, items: {} });
  if (data.items[ref]) return [ref, data.items[ref]];
  const n = parseInt(String(ref).replace("#", ""), 10);
  return Object.entries(data.items).find(([, s]) => s.number === n) || [null, null];
}

export async function setSuggestionStatus(guild, ref, status, reason, staffUser) {
  if (!STATUS[status]) return { error: `Status must be one of: ${Object.keys(STATUS).join(", ")}` };
  const [msgId, s] = findSuggestion(guild.id, ref);
  if (!s) return { error: "Suggestion not found." };
  s.status = status;
  s.reason = reason ? `${reason} — ${staffUser.tag || staffUser.username}` : `— ${staffUser.tag || staffUser.username}`;
  s.decidedAt = Date.now();
  saveFeatures();
  const channel = suggestionChannel(guild);
  const msg = channel ? await channel.messages.fetch(msgId).catch(() => null) : null;
  const author = await guild.client.users.fetch(s.authorId).catch(() => null);
  const closed = status === "approved" || status === "denied" || status === "implemented";
  if (msg) {
    await msg.edit({ embeds: [suggestionEmbed(s, author)], components: [suggestionRow(s, closed)] }).catch(() => {});
    // Archive + lock the discussion thread once a decision is final
    if (closed && msg.thread) await msg.thread.setLocked(true).then(() => msg.thread.setArchived(true)).catch(() => {});
  }
  if (author) await author.send(`Your suggestion #${s.number} in **${guild.name}** was marked **${STATUS[status].label}**.${reason ? `\n> ${reason}` : ""}`).catch(() => {});
  return { number: s.number };
}

// Plain messages typed in the suggestions channel become suggestions automatically.
export async function handleSuggestionChannelMessage(message) {
  if (!message.guild || message.author.bot) return false;
  const channel = suggestionChannel(message.guild);
  if (!channel || message.channelId !== channel.id) return false;
  if (getSettings(message.guild.id).suggestion_auto === "false") return false;
  if (message.content.startsWith("!") || message.content.length < 5) return false;
  await message.delete().catch(() => {});
  await postSuggestion(message.guild, message.author, message.content);
  return true;
}

export function similarSuggestions(guildId, text, limit = 3) {
  const data = featureData(guildId, "suggestions", { counter: 0, items: {} });
  const words = (t) => new Set(t.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
  const a = words(text);
  if (!a.size) return [];
  return Object.entries(data.items)
    .map(([id, s]) => {
      const b = words(s.text);
      const inter = [...a].filter((w) => b.has(w)).length;
      return { id, s, score: inter / Math.max(1, Math.min(a.size, b.size)) };
    })
    .filter((x) => x.score >= 0.4)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

// ===================== POLLS =====================
// featureData "polls": { [messageId]: { question, options, votes: { userId: index }, endsAt, channelId, ended } }
const NUM = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

function pollEmbed(p, authorName) {
  const total = Object.keys(p.votes).length;
  const counts = p.options.map((_, i) => Object.values(p.votes).filter((v) => v === i).length);
  const lines = p.options.map((o, i) => {
    const pct = total ? Math.round((counts[i] / total) * 100) : 0;
    const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
    return `${NUM[i]} **${o}**\n\`${bar}\` ${pct}% (${counts[i]})`;
  });
  return baseEmbed(p.ended ? COLORS.dark : COLORS.info)
    .setTitle(`📊 ${p.question}`)
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: `${total} vote${total === 1 ? "" : "s"}${authorName ? ` • by ${authorName}` : ""}${p.ended ? " • Poll closed" : p.endsAt ? " • closes" : ""}` })
    .setTimestamp(p.endsAt || null);
}

function pollRows(p) {
  const rows = [];
  for (let i = 0; i < p.options.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(p.options.slice(i, i + 5).map((o, j) =>
      new ButtonBuilder().setCustomId(`poll:${i + j}`).setEmoji(NUM[i + j]).setLabel(o.slice(0, 70)).setStyle(ButtonStyle.Secondary).setDisabled(!!p.ended))));
  }
  return rows;
}

export async function postPoll(channel, author, question, options, durationMs) {
  const p = { question, options, votes: {}, endsAt: durationMs ? Date.now() + durationMs : null, channelId: channel.id, author: author.username, ended: false };
  const msg = await channel.send({ embeds: [pollEmbed(p, author.username)], components: pollRows(p) });
  featureData(channel.guild.id, "polls", {})[msg.id] = p;
  saveFeatures();
  return msg;
}

export async function handlePollVote(interaction) {
  const p = featureData(interaction.guildId, "polls", {})[interaction.message.id];
  if (!p || p.ended) return interaction.reply({ content: "This poll is closed.", ephemeral: true });
  const idx = parseInt(interaction.customId.split(":")[1], 10);
  if (p.votes[interaction.user.id] === idx) delete p.votes[interaction.user.id]; // click again = unvote
  else p.votes[interaction.user.id] = idx;
  saveFeatures();
  return interaction.update({ embeds: [pollEmbed(p, p.author)], components: pollRows(p) });
}

// Scheduler tick: close polls whose time is up
export async function closeExpiredPolls(client) {
  for (const guild of client.guilds.cache.values()) {
    const polls = featureData(guild.id, "polls", {});
    for (const [id, p] of Object.entries(polls)) {
      if (p.ended && Date.now() - (p.endsAt || 0) > 30 * 86400000) { delete polls[id]; saveFeatures(); continue; }
      if (p.ended || !p.endsAt || p.endsAt > Date.now()) continue;
      p.ended = true;
      saveFeatures();
      const ch = guild.channels.cache.get(p.channelId);
      const msg = ch ? await ch.messages.fetch(id).catch(() => null) : null;
      if (msg) await msg.edit({ embeds: [pollEmbed(p, p.author)], components: pollRows(p) }).catch(() => {});
    }
  }
}

export { isStaff };
