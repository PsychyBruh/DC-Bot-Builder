import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, ChannelType, PermissionFlagsBits, AttachmentBuilder,
} from "discord.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { featureData, saveFeatures, resolveChannel, resolveRole, isStaff } from "./config.js";
import { getSettings } from "../storage/serverSettings.js";

// Default categories; a server can replace them with its own list (featureData ticketConfig.types).
export const TICKET_TYPES = {
  support:  { label: "Support",           emoji: "🛠️", desc: "Get help with anything",          prompt: "What do you need help with?" },
  report:   { label: "Report",            emoji: "🚨", desc: "Report a member or problem",      prompt: "Who/what are you reporting, and what happened? Include links/IDs." },
  appeal:   { label: "Appeal",            emoji: "⚖️", desc: "Appeal a punishment",             prompt: "What punishment are you appealing, and why should it be lifted?" },
  purchase: { label: "Purchase",          emoji: "💳", desc: "Questions about a purchase",      prompt: "What did you buy (or want to buy), and what's the issue?" },
  partner:  { label: "Partnership",       emoji: "🤝", desc: "Partner with the server",         prompt: "Tell us about your server/brand and the partnership you have in mind." },
  staff:    { label: "Staff Application", emoji: "📝", desc: "Apply to join the staff team",    prompt: "Why do you want to be staff, and what experience do you have?" },
};
const MAX_OPEN_PER_USER = 2;

export function getTicketTypes(guildId) {
  const custom = featureData(guildId, "ticketConfig", {}).types;
  return custom && Object.keys(custom).length ? custom : TICKET_TYPES;
}

function ticketLogChannel(guild) {
  return resolveChannel(guild, "ticket_log_channel", ["ticket-log", "ticket-logs", "tickets-log", "transcripts"]);
}
function staffRole(guild) {
  return resolveRole(guild, "staff_role", ["staff", "moderator", "mod"]);
}

async function ticketCategory(guild) {
  const id = getSettings(guild.id).ticket_category;
  let cat = id ? guild.channels.cache.get(id) : null;
  if (!cat) cat = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && /tickets?/i.test(c.name));
  if (!cat) {
    const staff = staffRole(guild);
    cat = await guild.channels.create({
      name: "🎫 Tickets",
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages] },
        ...(staff ? [{ id: staff.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
      ],
    });
  }
  return cat;
}

// ---------- panel ----------
export async function postTicketPanel(channel) {
  const types = getTicketTypes(channel.guild.id);
  const embed = baseEmbed(COLORS.primary)
    .setTitle("🎫 Create a Ticket")
    .setDescription(
      "Need help from the team? Pick a category below and a private channel will open just for you and staff.\n\n" +
      Object.values(types).map((t) => `${t.emoji || "🎫"} **${t.label}** — ${t.desc || ""}`).join("\n"),
    );
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
  const tickets = featureData(interaction.guildId, "tickets", { counter: 0, open: {} });
  const mine = Object.entries(tickets.open).filter(([cid, tk]) => tk.ownerId === interaction.user.id && interaction.guild.channels.cache.has(cid));
  if (mine.length >= MAX_OPEN_PER_USER) {
    return interaction.reply({ content: `You already have open tickets: ${mine.map(([cid]) => `<#${cid}>`).join(", ")}`, ephemeral: true });
  }
  const modal = new ModalBuilder().setCustomId(`tktm:${type}`).setTitle(`${t.label} Ticket`).addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("details").setLabel((t.prompt || "Describe your request").slice(0, 45)).setPlaceholder((t.prompt || "Describe your request").slice(0, 100))
        .setStyle(TextInputStyle.Paragraph).setMinLength(10).setMaxLength(1500).setRequired(true),
    ),
  );
  return interaction.showModal(modal);
}

export async function handleTicketModal(interaction) {
  const type = interaction.customId.split(":")[1];
  const t = getTicketTypes(interaction.guildId)[type] || { label: type, emoji: "🎫", prompt: "Details" };
  const details = interaction.fields.getTextInputValue("details");
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const tickets = featureData(guild.id, "tickets", { counter: 0, open: {} });
  tickets.counter += 1;
  const number = String(tickets.counter).padStart(4, "0");
  const staff = staffRole(guild);
  const cat = await ticketCategory(guild);
  const channel = await guild.channels.create({
    name: `${type}-${number}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90),
    type: ChannelType.GuildText,
    parent: cat.id,
    topic: `${t.label} ticket #${number} — opened by ${interaction.user.tag} (${interaction.user.id})`,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
      { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
      ...(staff ? [{ id: staff.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] }] : []),
    ],
  });
  tickets.open[channel.id] = { ownerId: interaction.user.id, type, number, openedAt: Date.now(), claimedBy: null };
  saveFeatures();

  const embed = baseEmbed(COLORS.primary)
    .setTitle(`${t.emoji || "🎫"} ${t.label} — Ticket #${number}`)
    .setDescription(`Thanks ${interaction.user}! A staff member will be with you soon.\n\n**${t.prompt || "Details"}**\n>>> ${details}`)
    .setFooter({ text: "Staff: Claim to take this ticket • Close when it's resolved" });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("tkt:claim").setLabel("Claim").setEmoji("🙋").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("tkt:close").setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Danger),
  );
  await channel.send({
    content: `${interaction.user}${staff ? ` ${staff}` : ""}`,
    embeds: [embed],
    components: [row],
    allowedMentions: { users: [interaction.user.id], roles: staff ? [staff.id] : [] },
  });
  await logTicket(guild, baseEmbed(COLORS.success).setTitle(`🎫 Ticket #${number} opened`)
    .setDescription(`**Type:** ${t.label}\n**By:** ${interaction.user} (${interaction.user.tag})\n**Channel:** ${channel}`));
  return interaction.editReply({ content: `✅ Your ticket is open: ${channel}` });
}

// ---------- claim / close ----------
export async function handleTicketButton(interaction) {
  const action = interaction.customId.split(":")[1];
  const tickets = featureData(interaction.guildId, "tickets", { counter: 0, open: {} });
  const tk = tickets.open[interaction.channelId];
  if (!tk) return interaction.reply({ content: "This isn't an open ticket.", ephemeral: true });

  if (action === "claim") {
    if (!isStaff(interaction.member)) return interaction.reply({ content: "Only staff can claim tickets.", ephemeral: true });
    if (tk.claimedBy) return interaction.reply({ content: `Already claimed by <@${tk.claimedBy}>.`, ephemeral: true });
    tk.claimedBy = interaction.user.id;
    saveFeatures();
    return interaction.reply({ embeds: [baseEmbed(COLORS.info).setDescription(`🙋 ${interaction.user} claimed this ticket.`)] });
  }
  if (action === "close") {
    if (!isStaff(interaction.member) && interaction.user.id !== tk.ownerId) {
      return interaction.reply({ content: "Only staff or the ticket owner can close this.", ephemeral: true });
    }
    await interaction.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`🔒 Closing ticket in 5 seconds… (closed by ${interaction.user})`)] });
    return closeTicket(interaction.channel, interaction.user, null);
  }
}

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
      ...m.embeds.map((e) => `[embed] ${e.title || ""} ${e.description || ""}`.trim()),
      ...[...m.attachments.values()].map((a) => `[attachment] ${a.url}`),
    ];
    return `[${time}] ${m.author?.tag || "unknown"}: ${m.content}${extra.length ? "\n    " + extra.join("\n    ") : ""}`;
  });
  return `Transcript of #${channel.name}\n${channel.topic || ""}\n${"=".repeat(60)}\n\n${lines.join("\n")}\n`;
}

export async function closeTicket(channel, closer, reason) {
  const guild = channel.guild;
  const tickets = featureData(guild.id, "tickets", { counter: 0, open: {} });
  const tk = tickets.open[channel.id];
  if (!tk) return false;
  delete tickets.open[channel.id];
  saveFeatures();
  const { bump } = await import("./stats.js");
  bump(guild.id, "ticketsClosed");
  const t = getTicketTypes(guild.id)[tk.type] || { label: tk.type };
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
  const log = ticketLogChannel(guild);
  if (log) await log.send({ embeds: [embed], files: [file()], allowedMentions: { parse: [] } }).catch(() => {});
  // Send the owner their transcript too (best effort — DMs may be closed)
  const owner = await guild.client.users.fetch(tk.ownerId).catch(() => null);
  if (owner) await owner.send({ content: `Your ticket in **${guild.name}** was closed.`, embeds: [embed], files: [file()] }).catch(() => {});
  setTimeout(() => channel.delete(`ticket closed by ${closer.tag || closer.id}`).catch(() => {}), 5000);
  return true;
}

async function logTicket(guild, embed) {
  const log = ticketLogChannel(guild);
  if (log) await log.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
}

export function getOpenTicket(guildId, channelId) {
  return featureData(guildId, "tickets", { counter: 0, open: {} }).open[channelId] || null;
}
