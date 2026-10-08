import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { featureData, saveFeatures, resolveChannel, resolveRole, memberAllowed, canManageRole, settingNum } from "./config.js";
import { getSettings } from "../storage/serverSettings.js";
import { bugForums, tagNames } from "./clean.js";

// Bug bridge: every post in a bug forum gets a staff-only "Confirm" button.
// Confirm → "Confirmed" tag, summary copied to the dev channel, optional GitHub issue, reporter credit.
// Tag changed to "Fixed" → reporter gets a thank-you DM. 3rd confirmed bug → Bug Hunter role.
// featureData "bugBridge": { [threadId]: { confirmed, issueUrl, reporterId } }, "bugCounts": { [userId]: n }

export async function onNewBugThread(thread) {
  if (!bugForums(thread.guild).some((f) => f.id === thread.parentId)) return;
  await new Promise((r) => setTimeout(r, 1500));
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bug:confirm:${thread.id}`).setLabel("Confirm (staff)").setEmoji("✅").setStyle(ButtonStyle.Secondary),
  );
  await thread.send({ embeds: [baseEmbed(COLORS.dark).setDescription("Thanks for the report! Staff will check it soon.")], components: [row] }).catch(() => {});
}

async function ensureTag(forum, name) {
  let tag = forum.availableTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (!tag && forum.availableTags.length < 20) {
    await forum.setAvailableTags([...forum.availableTags, { name }]).catch(() => {});
    tag = forum.availableTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  }
  return tag;
}

export async function handleBugButton(interaction) {
  const threadId = interaction.customId.split(":")[2];
  if (!memberAllowed(interaction.member, "bug_confirm_roles", null)) return interaction.reply({ content: "Only staff can confirm bugs.", ephemeral: true });
  const thread = interaction.guild.channels.cache.get(threadId) || await interaction.guild.channels.fetch(threadId).catch(() => null);
  if (!thread) return interaction.reply({ content: "Post not found.", ephemeral: true });
  const bridged = featureData(interaction.guildId, "bugBridge", {});
  if (bridged[threadId]?.confirmed) return interaction.reply({ content: "Already confirmed.", ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  const tag = await ensureTag(thread.parent, "Confirmed");
  if (tag && !thread.appliedTags.includes(tag.id)) await thread.setAppliedTags([...thread.appliedTags, tag.id].slice(0, 5)).catch(() => {});
  const res = await bridgeBug(thread, interaction.user);
  await interaction.message.edit({ components: [] }).catch(() => {});
  return interaction.editReply(`✅ Confirmed.${res.issueUrl ? ` GitHub: ${res.issueUrl}` : ""}`);
}

async function bridgeBug(thread, confirmer) {
  const guild = thread.guild;
  const bridged = featureData(guild.id, "bugBridge", {});
  const starter = await thread.fetchStarterMessage().catch(() => null);
  const body = starter?.content || "(no description)";
  const files = starter ? [...starter.attachments.values()].map((a) => a.url) : [];
  let issueUrl = null;
  const repo = getSettings(guild.id).github_repo;
  if (repo && process.env.GITHUB_TOKEN) {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "DC-Bot-Builder" },
        body: JSON.stringify({ title: thread.name, body: `${body}\n\n${files.map((u) => `![](${u})`).join("\n")}\n\n---\nReported by ${starter?.author?.tag || "unknown"} · confirmed by ${confirmer?.tag || "staff"}\n${thread.url}`, labels: ["bug", "confirmed"] }),
      });
      if (res.ok) issueUrl = (await res.json()).html_url;
    } catch {}
  }
  const out = resolveChannel(guild, "bug_confirmed_channel", ["dev-chat", "confirmed-bugs", "dev-bugs"]);
  if (out) {
    const tags = tagNames(thread).filter((t) => t !== "confirmed");
    const e = baseEmbed(COLORS.danger).setTitle(`🐞 ${thread.name}`.slice(0, 256)).setURL(thread.url).setDescription(body.slice(0, 3500))
      .addFields(
        { name: "Reporter", value: starter?.author ? `${starter.author}` : "unknown", inline: true },
        { name: "Forum", value: `<#${thread.parentId}>`, inline: true },
        { name: "Tags", value: tags.join(", ") || "—", inline: true },
      );
    if (files.length) e.addFields({ name: "Attachments", value: files.slice(0, 5).join("\n").slice(0, 1024) });
    if (issueUrl) e.addFields({ name: "GitHub", value: issueUrl });
    if (files[0] && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(files[0])) e.setImage(files[0]);
    await out.send({ embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
  }
  bridged[thread.id] = { confirmed: true, issueUrl, reporterId: thread.ownerId, at: Date.now() };
  // Reporter credit → Bug Hunter at the threshold
  const counts = featureData(guild.id, "bugCounts", {});
  counts[thread.ownerId] = (counts[thread.ownerId] || 0) + 1;
  saveFeatures();
  const need = settingNum(guild.id, "bug_hunter_threshold", 3);
  const hunter = resolveRole(guild, "bug_hunter_role", ["bug hunter"]);
  if (hunter && counts[thread.ownerId] >= need && canManageRole(guild, hunter)) {
    const m = await guild.members.fetch(thread.ownerId).catch(() => null);
    if (m && !m.roles.cache.has(hunter.id)) {
      await m.roles.add(hunter, `${need} confirmed bugs`).catch(() => {});
      await m.send(`🏅 You earned **${hunter.name}** in **${guild.name}** for ${need} confirmed bug reports. Thank you!`).catch(() => {});
    }
  }
  if (issueUrl) await thread.send(`📎 Tracked on GitHub: ${issueUrl}`).catch(() => {});
  return { issueUrl };
}

export async function handleBugTagChange(oldThread, newThread) {
  const guild = newThread.guild;
  if (!bugForums(guild).some((f) => f.id === newThread.parentId)) return;
  const before = tagNames(oldThread), after = tagNames(newThread);
  const bridged = featureData(guild.id, "bugBridge", {});
  // Confirmed tag added by hand (instead of the button) → bridge too
  if (after.includes("confirmed") && !before.includes("confirmed") && !bridged[newThread.id]?.confirmed) await bridgeBug(newThread, null);
  if (after.some((t) => /^fixed$/.test(t)) && !before.some((t) => /^fixed$/.test(t))) {
    const version = getSettings(guild.id).current_version;
    const reporter = await guild.client.users.fetch(newThread.ownerId).catch(() => null);
    if (reporter) await reporter.send(`🛠️ Your bug "${newThread.name}" in **${guild.name}** was fixed${version ? ` in ${version}` : ""} — thanks!`).catch(() => {});
  }
}
