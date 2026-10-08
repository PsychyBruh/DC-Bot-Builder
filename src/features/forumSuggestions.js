import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { featureData, saveFeatures, resolveChannel, resolveRole, isStaff } from "./config.js";
import { suggestionForum } from "./clean.js";

// Forum-based suggestions: every post gets ✅/❌ vote buttons + staff Accept / Deny / Planned.
// featureData "forumSuggestions": { [threadId]: { up:[], down:[], msgId, authorId, status } }
const store = (g) => featureData(g, "forumSuggestions", {});

function voteRow(s) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("fs:up").setEmoji("✅").setLabel(String(s.up.length)).setStyle(ButtonStyle.Secondary).setDisabled(!!s.closed),
      new ButtonBuilder().setCustomId("fs:down").setEmoji("❌").setLabel(String(s.down.length)).setStyle(ButtonStyle.Secondary).setDisabled(!!s.closed),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("fs:accept").setLabel("Accept").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("fs:planned").setLabel("Planned").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("fs:deny").setLabel("Deny").setStyle(ButtonStyle.Secondary),
    ),
  ];
}
const voteEmbed = (s) => baseEmbed(COLORS.dark).setDescription(`**Votes:** ✅ ${s.up.length} · ❌ ${s.down.length}${s.status ? `\n**Status:** ${s.status}` : ""}`).setFooter({ text: "One vote per person • click again to remove" });

export async function onNewSuggestionThread(thread) {
  const forum = suggestionForum(thread.guild);
  if (!forum || thread.parentId !== forum.id) return;
  const ban = resolveRole(thread.guild, "suggestion_ban_role", ["suggestion banned"]);
  const owner = await thread.guild.members.fetch(thread.ownerId).catch(() => null);
  if (ban && owner?.roles.cache.has(ban.id)) {
    await owner.send(`You can't post suggestions in **${thread.guild.name}** right now.`).catch(() => {});
    await thread.delete("suggestion banned").catch(() => {});
    return;
  }
  await new Promise((r) => setTimeout(r, 1500));
  const s = { up: [], down: [], authorId: thread.ownerId, status: null, at: Date.now() };
  const msg = await thread.send({ embeds: [voteEmbed(s)], components: voteRow(s) }).catch(() => null);
  if (!msg) return;
  s.msgId = msg.id;
  store(thread.guild.id)[thread.id] = s;
  saveFeatures();
}

async function setTag(thread, name) {
  const forum = thread.parent;
  let tag = forum.availableTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (!tag && forum.availableTags.length < 20) {
    await forum.setAvailableTags([...forum.availableTags, { name }]).catch(() => {});
    tag = forum.availableTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  }
  if (!tag) return;
  const keep = thread.appliedTags.filter((id) => !/^(accepted|denied|planned)$/i.test(forum.availableTags.find((t) => t.id === id)?.name || ""));
  await thread.setAppliedTags([...keep, tag.id].slice(0, 5)).catch(() => {});
}

export async function handleForumSuggestionButton(interaction) {
  const thread = interaction.channel;
  const s = store(interaction.guildId)[thread.id];
  if (!s) return interaction.reply({ content: "This suggestion isn't tracked.", ephemeral: true });
  const action = interaction.customId.split(":")[1];
  if (action === "up" || action === "down") {
    if (s.closed) return interaction.reply({ content: "Voting is closed.", ephemeral: true });
    const uid = interaction.user.id;
    const mine = action === "up" ? s.up : s.down;
    const other = action === "up" ? s.down : s.up;
    if (mine.includes(uid)) mine.splice(mine.indexOf(uid), 1);
    else { mine.push(uid); if (other.includes(uid)) other.splice(other.indexOf(uid), 1); }
    saveFeatures();
    return interaction.update({ embeds: [voteEmbed(s)], components: voteRow(s) });
  }
  if (!isStaff(interaction.member)) return interaction.reply({ content: "Staff only.", ephemeral: true });
  if (action === "deny") {
    const modal = new ModalBuilder().setCustomId(`sgd:${thread.id}`).setTitle("Deny suggestion").addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Reason").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800)));
    return interaction.showModal(modal);
  }
  if (action === "accept") {
    s.status = "Accepted ✅";
    s.closed = true;
    saveFeatures();
    await setTag(thread, "Accepted");
    const out = resolveChannel(interaction.guild, "accepted_channel", ["accepted-ideas", "accepted"]);
    const starter = await thread.fetchStarterMessage().catch(() => null);
    if (out) await out.send({ embeds: [baseEmbed(COLORS.success).setTitle(`✅ ${thread.name}`.slice(0, 256)).setURL(thread.url)
      .setDescription(`${(starter?.content || "").slice(0, 3000)}\n\n✅ ${s.up.length} · ❌ ${s.down.length} — suggested by <@${s.authorId}>`)], allowedMentions: { parse: [] } }).catch(() => {});
    await interaction.update({ embeds: [voteEmbed(s)], components: voteRow(s) });
    await thread.send(`✅ Accepted by ${interaction.user}.`).catch(() => {});
    const author = await interaction.client.users.fetch(s.authorId).catch(() => null);
    if (author) await author.send(`Your suggestion **${thread.name}** in **${interaction.guild.name}** was accepted! 🎉`).catch(() => {});
    return;
  }
  if (action === "planned") {
    s.status = "Planned 🗺️";
    saveFeatures();
    await setTag(thread, "Planned");
    await interaction.update({ embeds: [voteEmbed(s)], components: voteRow(s) });
    return thread.send(`🗺️ Marked as planned by ${interaction.user}.`).catch(() => {});
  }
}

export async function handleDenyModal(interaction) {
  const threadId = interaction.customId.split(":")[1];
  const thread = interaction.guild.channels.cache.get(threadId) || await interaction.guild.channels.fetch(threadId).catch(() => null);
  const s = store(interaction.guildId)[threadId];
  if (!thread || !s) return interaction.reply({ content: "Not found.", ephemeral: true });
  const reason = interaction.fields.getTextInputValue("reason");
  s.status = "Denied ❌";
  s.closed = true;
  saveFeatures();
  await setTag(thread, "Denied");
  const msg = await thread.messages.fetch(s.msgId).catch(() => null);
  if (msg) await msg.edit({ embeds: [voteEmbed(s)], components: voteRow(s) }).catch(() => {});
  await interaction.reply({ content: `❌ Denied by ${interaction.user}\n**Reason:** ${reason}` });
  const author = await interaction.client.users.fetch(s.authorId).catch(() => null);
  if (author) await author.send(`Your suggestion **${thread.name}** in **${interaction.guild.name}** wasn't accepted.\n> ${reason}`).catch(() => {});
  await thread.setLocked(true).catch(() => {});
}

// For the weekly report
export function topForumSuggestions(guildId, since, limit = 5) {
  return Object.entries(store(guildId))
    .filter(([, s]) => (s.at || 0) >= since)
    .sort((a, b) => (b[1].up.length - b[1].down.length) - (a[1].up.length - a[1].down.length))
    .slice(0, limit);
}
