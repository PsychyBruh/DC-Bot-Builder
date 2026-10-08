import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, ChannelType, PermissionFlagsBits, AttachmentBuilder,
} from "discord.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import {
  featureData, saveFeatures, resolveChannel, resolveRole, resolveRoles, isStaff, settingNum, canManageRole,
} from "./config.js";
import { getSettings } from "../storage/serverSettings.js";

// Ticket type config (per server, featureData ticketConfig.types):
// { key: { label, emoji, desc, prompt, viewer_roles:[ids], open_role, form:[[id,label,"short"|"paragraph"]],
//          review_channel, review_roles:[ids], accept_add_roles:[ids], accept_remove_roles:[ids], deny_remove_roles:[ids], requires_link } }
export const TICKET_TYPES = {
  support:  { label: "Support",           emoji: "🛠️", desc: "Get help with anything",          prompt: "What do you need help with?" },
  report:   { label: "Report",            emoji: "🚨", desc: "Report a member or problem",      prompt: "Who/what are you reporting, and what happened?" },
  appeal:   { label: "Appeal",            emoji: "⚖️", desc: "Appeal a punishment",             prompt: "What are you appealing, and why should it be lifted?" },
  purchase: { label: "Purchase",          emoji: "💳", desc: "Questions about a purchase",      prompt: "What did you buy, and what's the issue?" },
  partner:  { label: "Partnership",       emoji: "🤝", desc: "Partner with the server",         prompt: "Tell us about your community and the partnership." },
  staff:    { label: "Staff Application", emoji: "📝", desc: "Apply to join the staff team",    prompt: "Why do you want to be staff?" },
};

export function getTicketTypes(guildId) {
  const custom = featureData(guildId, "ticketConfig", {}).types;
  return custom && Object.keys(custom).length ? custom : TICKET_TYPES;
}
const tickets = (guildId) => featureData(guildId, "tickets", { counter: 0, open: {} });

function ticketLogChannel(guild) {
  return resolveChannel(guild, "ticket_log_channel", ["ticket-log", "ticket-logs", "tickets-log", "transcripts"]);
}
function staffViewers(guild, type) {
  const base = resolveRoles(guild, "ticket_staff_roles", []);
  const fallback = base.length ? base : [resolveRole(guild, "staff_role", ["staff", "moderator", "mod"])].filter(Boolean);
  const extra = (type?.viewer_roles || []).map((id) => guild.roles.cache.get(id) || guild.roles.cache.find((r) => r.name === id)).filter(Boolean);
  return [...new Set([...fallback, ...extra])];
}
const logTicket = async (guild, embed, files) => {
  const log = ticketLogChannel(guild);
  if (log) await log.send({ embeds: [embed], files, allowedMentions: { parse: [] } }).catch(() => {});
};

async function ticketCategory(guild) {
  const id = getSettings(guild.id).ticket_category;
  let cat = id ? guild.channels.cache.get(id) : null;
  if (!cat) cat = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && /tickets?/i.test(c.name));
  if (!cat) {
    cat = await guild.channels.create({
      name: "🎫 TICKETS",
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages] },
      ],
    });
  }
  return cat;
}

// ---------- panel ----------
export async function postTicketPanel(channel) {
  const types = getTicketTypes(channel.guild.id);
  const embed = baseEmbed(COLORS.dark)
    .setTitle("🎫 Create a Ticket")
    .setDescription("Need the team? Pick a type below — a private channel opens just for you and staff.\n\n" +
      Object.values(types).map((t) => `${t.emoji || "🎫"} **${t.label}** — ${t.desc || ""}`).join("\n"));
  embed.data.timestamp = undefined;
  const menu = new StringSelectMenuBuilder()
    .setCustomId("tkt:open")
    .setPlaceholder("Select a ticket type…")
    .addOptions(Object.entries(types).slice(0, 25).map(([value, t]) => ({ label: t.label.slice(0, 100), value, description: (t.desc || t.label).slice(0, 100), emoji: t.emoji || "🎫" })));
  return channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
}

// ---------- open: select → modal → channel ----------
export async function handleTicketSelect(interaction) {
  const type = interaction.values[0];
  const t = getTicketTypes(interaction.guildId)[type];
  if (!t) return interaction.reply({ content: "Unknown ticket type.", ephemeral: true });
  const ban = resolveRole(interaction.guild, "ticket_ban_role", ["ticket banned"]);
  if (ban && interaction.member.roles.cache.has(ban.id)) return interaction.reply({ content: "You're not able to open tickets right now.", ephemeral: true });
  const mine = Object.entries(tickets(interaction.guildId).open).find(([cid, tk]) => tk.ownerId === interaction.user.id && tk.type === type && interaction.guild.channels.cache.has(cid));
  if (mine) return interaction.reply({ content: `You already have an open ${t.label} ticket: <#${mine[0]}>`, ephemeral: true });
  if (t.requires_link) {
    const { getLink } = await import("./roblox.js");
    if (!getLink(interaction.user.id)) return interaction.reply({ content: "You need to link your Roblox account first — use `!link <username>` in the bot commands channel.", ephemeral: true });
  }
  const modal = new ModalBuilder().setCustomId(`tktm:${type}`).setTitle(`${t.label}`.slice(0, 45));
  const form = (t.form || []).slice(0, 5);
  if (form.length) {
    for (const [id, label, style] of form) {
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId(id).setLabel(String(label).slice(0, 45)).setRequired(true)
          .setStyle(style === "short" ? TextInputStyle.Short : TextInputStyle.Paragraph).setMaxLength(style === "short" ? 200 : 1000)));
    }
  } else {
    const prompt = t.prompt || "Describe your request";
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("details").setLabel(prompt.slice(0, 45)).setPlaceholder(prompt.slice(0, 100))
        .setStyle(TextInputStyle.Paragraph).setMinLength(5).setMaxLength(1500).setRequired(true)));
  }
  return interaction.showModal(modal);
}

function ticketButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("tkt:claim").setLabel("Claim").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("tkt:add").setLabel("Add User").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("tkt:close").setLabel("Close").setStyle(ButtonStyle.Secondary),
  );
}

export async function handleTicketModal(interaction) {
  const [, type] = interaction.customId.split(":");
  const guild = interaction.guild;
  const t = getTicketTypes(guild.id)[type] || { label: type, emoji: "🎫" };
  await interaction.deferReply({ ephemeral: true });
  const data = tickets(guild.id);
  data.counter += 1;
  const number = String(data.counter).padStart(4, "0");
  const viewers = staffViewers(guild, t);
  const cat = await ticketCategory(guild);
  const channel = await guild.channels.create({
    name: `ticket-${type}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90),
    type: ChannelType.GuildText,
    parent: cat.id,
    topic: `${t.label} ticket #${number} — opened by ${interaction.user.tag} (${interaction.user.id})`,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
      { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
      ...viewers.map((r) => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageMessages] })),
    ],
  });
  data.open[channel.id] = { ownerId: interaction.user.id, type, number, openedAt: Date.now(), lastOwnerActivity: Date.now(), claimedBy: null, firstStaffReplyAt: null, lastStaffReplyAt: null };
  saveFeatures();
  const { bump, bumpMap } = await import("./stats.js");
  bump(guild.id, "ticketsOpened");
  bumpMap(guild.id, "ticketsOpenedByType", t.label);

  // Role while the ticket is open (e.g. Tester Applicant)
  if (t.open_role) {
    const r = guild.roles.cache.get(t.open_role) || guild.roles.cache.find((x) => x.name === t.open_role);
    if (r && canManageRole(guild, r)) await interaction.member.roles.add(r, "ticket opened").catch(() => {});
  }

  const form = (t.form || []).slice(0, 5);
  const embed = baseEmbed(COLORS.dark).setTitle(`${t.emoji || "🎫"} ${t.label} — #${number}`);
  if (form.length) {
    embed.setDescription(`Thanks ${interaction.user}! Staff will review this soon.`)
      .addFields(form.map(([id, label]) => ({ name: String(label).slice(0, 256), value: interaction.fields.getTextInputValue(id) || "—" })));
  } else {
    embed.setDescription(`Thanks ${interaction.user}! A staff member will be with you soon.\n\n**${t.prompt || "Details"}**\n>>> ${interaction.fields.getTextInputValue("details")}`);
  }
  embed.setFooter({ text: "Staff: Claim to take this ticket • Close when it's resolved" });
  await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [ticketButtons()], allowedMentions: { users: [interaction.user.id] } });

  // Application-style ticket: copy to the review channel with Accept / Deny
  if (form.length && t.review_channel) {
    const review = guild.channels.cache.get(t.review_channel) || resolveChannel(guild, null, [t.review_channel]);
    if (review) {
      const copy = baseEmbed(COLORS.info).setTitle(`${t.emoji || "📝"} ${t.label} — ${interaction.user.tag}`)
        .setDescription(`**Applicant:** ${interaction.user}\n**Account created:** <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>\n**Ticket:** ${channel}`)
        .addFields(form.map(([id, label]) => ({ name: String(label).slice(0, 256), value: interaction.fields.getTextInputValue(id) || "—" })))
        .setFooter({ text: "Status: pending" });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tkr:accept:${channel.id}`).setLabel("Accept").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`tkr:deny:${channel.id}`).setLabel("Deny").setStyle(ButtonStyle.Danger),
      );
      const m = await review.send({ embeds: [copy], components: [row], allowedMentions: { parse: [] } }).catch(() => null);
      if (m) { data.open[channel.id].reviewMessage = { channelId: review.id, messageId: m.id }; saveFeatures(); }
    }
  }
  await logTicket(guild, baseEmbed(COLORS.success).setTitle(`🎫 Ticket #${number} opened`).setDescription(`**Type:** ${t.label}\n**By:** ${interaction.user} (${interaction.user.tag})\n**Channel:** ${channel}`));
  return interaction.editReply({ content: `✅ Your ticket is open: ${channel}` });
}

// ---------- claim / add / close ----------
export async function handleTicketButton(interaction) {
  const action = interaction.customId.split(":")[1];
  const tk = tickets(interaction.guildId).open[interaction.channelId];
  if (!tk) return interaction.reply({ content: "This isn't an open ticket.", ephemeral: true });
  const staff = isStaff(interaction.member) || staffViewers(interaction.guild, getTicketTypes(interaction.guildId)[tk.type]).some((r) => interaction.member.roles.cache.has(r.id));

  if (action === "claim") {
    if (!staff) return interaction.reply({ content: "Only staff can claim tickets.", ephemeral: true });
    if (tk.claimedBy) return interaction.reply({ content: `Already claimed by <@${tk.claimedBy}>.`, ephemeral: true });
    tk.claimedBy = interaction.user.id;
    tk.claimedAt = Date.now();
    tk.lastStaffReplyAt = Date.now();
    saveFeatures();
    await logTicket(interaction.guild, baseEmbed(COLORS.info).setTitle(`🙋 Ticket #${tk.number} claimed`).setDescription(`By ${interaction.user} in <#${interaction.channelId}>`));
    return interaction.reply({ embeds: [baseEmbed(COLORS.info).setDescription(`🙋 ${interaction.user} claimed this ticket.`)] });
  }
  if (action === "add") {
    if (!staff && interaction.user.id !== tk.ownerId) return interaction.reply({ content: "Only staff or the ticket owner can add people.", ephemeral: true });
    const modal = new ModalBuilder().setCustomId("tkta:add").setTitle("Add someone to this ticket").addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("user").setLabel("Username or user ID").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40)));
    return interaction.showModal(modal);
  }
  if (action === "close") {
    if (!staff && interaction.user.id !== tk.ownerId) return interaction.reply({ content: "Only staff or the ticket owner can close this.", ephemeral: true });
    const modal = new ModalBuilder().setCustomId("tktc:close").setTitle("Close ticket").addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Reason").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)));
    return interaction.showModal(modal);
  }
}

export async function handleTicketAddModal(interaction) {
  const q = interaction.fields.getTextInputValue("user").trim().replace(/^<@!?(\d+)>$/, "$1").replace(/^@/, "");
  const guild = interaction.guild;
  let member = /^\d+$/.test(q) ? await guild.members.fetch(q).catch(() => null) : null;
  if (!member) member = (await guild.members.fetch({ query: q, limit: 1 }).catch(() => null))?.first();
  if (!member) return interaction.reply({ content: `Couldn't find "${q}".`, ephemeral: true });
  await interaction.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
  return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ Added ${member} to this ticket.`)] });
}

export async function handleTicketCloseModal(interaction) {
  const reason = interaction.fields.getTextInputValue("reason");
  const delay = settingNum(interaction.guildId, "ticket_close_delay", 10);
  await interaction.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`🔒 Closing in ${delay} seconds… (by ${interaction.user})\n**Reason:** ${reason}`)] });
  return closeTicket(interaction.channel, interaction.user, reason);
}

// ---------- application review (Accept / Deny) ----------
function canReview(member, t, ownerId) {
  if (member.id === ownerId) return false; // never your own application
  const roles = (t.review_roles || []).map((id) => member.guild.roles.cache.get(id) || member.guild.roles.cache.find((r) => r.name === id)).filter(Boolean);
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (roles.length) return roles.some((r) => member.roles.cache.has(r.id));
  return resolveRoles(member.guild, "leadership_roles", []).some((r) => member.roles.cache.has(r.id)) || isStaff(member);
}

export async function handleReviewButton(interaction) {
  const [, action, channelId] = interaction.customId.split(":");
  const tk = tickets(interaction.guildId).open[channelId];
  if (!tk) return interaction.reply({ content: "This application's ticket is closed.", ephemeral: true });
  const t = getTicketTypes(interaction.guildId)[tk.type] || {};
  if (tk.ownerId === interaction.user.id) return interaction.reply({ content: "You can't review your own application.", ephemeral: true });
  if (!canReview(interaction.member, t, tk.ownerId)) return interaction.reply({ content: "You can't review this type of application.", ephemeral: true });
  if (tk.decision) return interaction.reply({ content: `Already ${tk.decision}.`, ephemeral: true });
  if (action === "deny") {
    const modal = new ModalBuilder().setCustomId(`tkrd:${channelId}`).setTitle("Deny application").addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Reason (sent to the applicant)").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800)));
    return interaction.showModal(modal);
  }
  return decide(interaction, channelId, "accepted", null);
}

export async function handleReviewDenyModal(interaction) {
  return decide(interaction, interaction.customId.split(":")[1], "denied", interaction.fields.getTextInputValue("reason"));
}

async function decide(interaction, channelId, decision, reason) {
  const guild = interaction.guild;
  const tk = tickets(guild.id).open[channelId];
  if (!tk || tk.decision) return interaction.reply({ content: "Already handled.", ephemeral: true });
  const t = getTicketTypes(guild.id)[tk.type] || { label: tk.type };
  tk.decision = decision;
  saveFeatures();
  const member = await guild.members.fetch(tk.ownerId).catch(() => null);
  const ids = (list) => (list || []).map((id) => guild.roles.cache.get(id) || guild.roles.cache.find((r) => r.name === id)).filter((r) => r && canManageRole(guild, r));
  const changed = [];
  if (member) {
    const remove = [...(t.open_role ? ids([t.open_role]) : []), ...ids(decision === "accepted" ? t.accept_remove_roles : t.deny_remove_roles)];
    const add = decision === "accepted" ? ids(t.accept_add_roles) : [];
    for (const r of remove) if (member.roles.cache.has(r.id)) { await member.roles.remove(r, `application ${decision}`).catch(() => {}); changed.push(`-${r.name}`); }
    for (const r of add) { await member.roles.add(r, `application ${decision}`).catch(() => {}); changed.push(`+${r.name}`); }
    await member.send({ embeds: [baseEmbed(decision === "accepted" ? COLORS.success : COLORS.dark)
      .setTitle(`${t.label} ${decision === "accepted" ? "accepted 🎉" : "— update"}`)
      .setDescription(decision === "accepted"
        ? `Your **${t.label}** in **${guild.name}** was accepted. Welcome aboard!`
        : `Thanks for applying for **${t.label}** in **${guild.name}**. Unfortunately it wasn't accepted this time.${reason ? `\n\n>>> ${reason}` : ""}`)] }).catch(() => {});
  }
  if (tk.reviewMessage) {
    const ch = guild.channels.cache.get(tk.reviewMessage.channelId);
    const m = ch ? await ch.messages.fetch(tk.reviewMessage.messageId).catch(() => null) : null;
    if (m) {
      const e = baseEmbed(decision === "accepted" ? COLORS.success : COLORS.danger);
      e.data = { ...m.embeds[0].data, color: decision === "accepted" ? COLORS.success : COLORS.danger, footer: { text: `${decision === "accepted" ? "Accepted" : "Denied"} by ${interaction.user.tag}${reason ? ` — ${reason}`.slice(0, 1500) : ""}` } };
      await m.edit({ embeds: [e], components: [] }).catch(() => {});
    }
  }
  const ticketCh = guild.channels.cache.get(channelId);
  if (ticketCh) await ticketCh.send({ embeds: [baseEmbed(decision === "accepted" ? COLORS.success : COLORS.danger).setDescription(`${decision === "accepted" ? "✅ Accepted" : "❌ Denied"} by ${interaction.user}${reason ? `\n**Reason:** ${reason}` : ""}${changed.length ? `\nRoles: ${changed.join(", ")}` : ""}`)] }).catch(() => {});
  return interaction.reply({ content: `${decision === "accepted" ? "✅ Accepted" : "❌ Denied"} <@${tk.ownerId}>.${changed.length ? ` (${changed.join(", ")})` : ""}`, ephemeral: true });
}

// ---------- transcript / close ----------
async function buildTranscript(channel) {
  const all = [];
  let before;
  for (let i = 0; i < 10; i++) { // up to 1000 messages
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch?.size) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  all.reverse();
  const lines = all.map((m) => {
    const time = new Date(m.createdTimestamp).toISOString().replace("T", " ").slice(0, 19);
    const extra = [
      ...m.embeds.map((e) => `[embed] ${e.title || ""} ${e.description || ""} ${(e.fields || []).map((f) => `${f.name}: ${f.value}`).join(" | ")}`.trim()),
      ...[...m.attachments.values()].map((a) => `[attachment] ${a.url}`),
    ];
    return `[${time}] ${m.author?.tag || "unknown"}: ${m.content}${extra.length ? "\n    " + extra.join("\n    ") : ""}`;
  });
  return `Transcript of #${channel.name}\n${channel.topic || ""}\n${"=".repeat(60)}\n\n${lines.join("\n")}\n`;
}

export async function closeTicket(channel, closer, reason) {
  const guild = channel.guild;
  const data = tickets(guild.id);
  const tk = data.open[channel.id];
  if (!tk) return false;
  delete data.open[channel.id];
  saveFeatures();
  const t = getTicketTypes(guild.id)[tk.type] || { label: tk.type };
  const { bump, bumpMap, recordResponse } = await import("./stats.js");
  bump(guild.id, "ticketsClosed");
  bumpMap(guild.id, "ticketsClosedByType", t.label);
  if (tk.firstStaffReplyAt) recordResponse(guild.id, tk.firstStaffReplyAt - tk.openedAt);
  if (t.open_role && !tk.decision) {
    const m = await guild.members.fetch(tk.ownerId).catch(() => null);
    const r = guild.roles.cache.get(t.open_role) || guild.roles.cache.find((x) => x.name === t.open_role);
    if (m && r && canManageRole(guild, r)) await m.roles.remove(r, "ticket closed").catch(() => {});
  }
  const transcript = await buildTranscript(channel);
  const file = () => new AttachmentBuilder(Buffer.from(transcript, "utf-8"), { name: `ticket-${tk.number}.txt` });
  const mins = Math.round((Date.now() - tk.openedAt) / 60000);
  const embed = baseEmbed(COLORS.danger).setTitle(`🔒 Ticket #${tk.number} closed`).setDescription([
    `**Type:** ${t.label}`,
    `**Opened by:** <@${tk.ownerId}>`,
    `**Closed by:** ${closer}`,
    tk.claimedBy ? `**Claimed by:** <@${tk.claimedBy}>` : null,
    reason ? `**Reason:** ${reason}` : null,
    `**Open for:** ${mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} h`}`,
  ].filter(Boolean).join("\n"));
  await logTicket(guild, embed, [file()]);
  const owner = await guild.client.users.fetch(tk.ownerId).catch(() => null);
  if (owner) await owner.send({ content: `Your ticket in **${guild.name}** was closed.`, embeds: [embed], files: [file()] }).catch(() => {});
  const delay = settingNum(guild.id, "ticket_close_delay", 10);
  setTimeout(() => channel.delete(`ticket closed by ${closer.tag || closer.id}`).catch(() => {}), Math.max(1, delay) * 1000);
  return true;
}

export function getOpenTicket(guildId, channelId) {
  return tickets(guildId).open[channelId] || null;
}
