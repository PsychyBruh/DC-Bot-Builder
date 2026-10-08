import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } from "discord.js";

// Panels must never hand out a role with real power, no matter what the panel was configured with.
const DANGEROUS = [
  "Administrator", "ManageGuild", "ManageRoles", "ManageChannels", "KickMembers", "BanMembers", "ModerateMembers",
  "ManageMessages", "ManageWebhooks", "MentionEveryone", "ManageNicknames", "ManageThreads", "ViewAuditLog", "MoveMembers", "MuteMembers", "DeafenMembers", "ManageEvents",
].map((p) => PermissionFlagsBits[p]);
export function isSafeSelfRole(role) {
  return !!role && !DANGEROUS.some((b) => role.permissions.has(b, false));
}
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { featureData, saveFeatures, resolveRole, canManageRole } from "./config.js";

// ---------- parsing ----------
const CUSTOM_EMOJI = /^<a?:\w+:(\d+)>$/;

// "🎮 @PC, 🕹️ @Console, @Mobile" → [{ emoji, role }]
export function parseRoleEntries(guild, text) {
  const out = [];
  const errors = [];
  for (const raw of text.split(",").map((s) => s.trim()).filter(Boolean)) {
    const tokens = raw.split(/\s+/);
    let emoji = null;
    if (CUSTOM_EMOJI.test(tokens[0]) || /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(tokens[0])) emoji = tokens.shift();
    const roleText = tokens.join(" ").replace(/^@(?!&)/, "");
    const id = roleText.match(/^<@&(\d+)>$/)?.[1] || (/^\d+$/.test(roleText) ? roleText : null);
    const role = id ? guild.roles.cache.get(id) : guild.roles.cache.find((r) => r.name.toLowerCase() === roleText.toLowerCase());
    if (!role) { errors.push(`role not found: \`${roleText}\``); continue; }
    if (!canManageRole(guild, role)) { errors.push(`I can't manage **${role.name}** (move my role above it)`); continue; }
    if (!isSafeSelfRole(role)) { errors.push(`**${role.name}** has moderation/admin permissions — not allowed on a self-role panel`); continue; }
    out.push({ roleId: role.id, emoji, label: role.name });
  }
  return { entries: out, errors };
}

function emojiForComponent(e) {
  if (!e) return undefined;
  const m = e.match(/^<(a?):(\w+):(\d+)>$/);
  return m ? { id: m[3], name: m[2], animated: !!m[1] } : e;
}

// ---------- panel creation ----------
export async function postSelfRolePanel(channel, { mode, title, description, exclusive, entries }) {
  const embed = baseEmbed(COLORS.primary)
    .setTitle(title)
    .setDescription(
      (description ? description + "\n\n" : "") +
      entries.map((e) => `${e.emoji ? e.emoji + " " : "• "}<@&${e.roleId}>${e.description ? ` — ${e.description}` : ""}`).join("\n") +
      `\n\n*${mode === "reactions" ? "React" : mode === "dropdown" ? "Pick from the menu" : "Click a button"} to ${exclusive ? "choose one" : "add or remove roles"}.*`,
    );
  embed.data.timestamp = undefined;
  const components = [];
  if (mode === "buttons") {
    for (let i = 0; i < entries.length; i += 5) {
      components.push(new ActionRowBuilder().addComponents(entries.slice(i, i + 5).map((e) => {
        const b = new ButtonBuilder().setCustomId(`sr:${e.roleId}`).setLabel(e.label.slice(0, 80)).setStyle(ButtonStyle.Secondary);
        if (e.emoji) b.setEmoji(emojiForComponent(e.emoji));
        return b;
      })));
    }
    const clear = new ButtonBuilder().setCustomId("sr:clear").setLabel("Clear").setEmoji("🧹").setStyle(ButtonStyle.Secondary);
    if (components.length && components[components.length - 1].components.length < 5) components[components.length - 1].addComponents(clear);
    else if (components.length < 5) components.push(new ActionRowBuilder().addComponents(clear));
  } else if (mode === "dropdown") {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("srsel")
      .setPlaceholder(exclusive ? "Choose one…" : "Choose any…")
      .setMinValues(0)
      .setMaxValues(exclusive ? 1 : Math.min(25, entries.length + 1))
      .addOptions(entries.slice(0, 24).map((e) => {
        const o = { label: e.label.slice(0, 100), value: e.roleId };
        if (e.description) o.description = e.description.slice(0, 100);
        if (e.emoji) o.emoji = emojiForComponent(e.emoji);
        return o;
      }))
      .addOptions({ label: "Clear", value: "__clear", description: "Remove all roles from this panel", emoji: "🧹" });
    components.push(new ActionRowBuilder().addComponents(menu));
  }
  const msg = await channel.send({ embeds: [embed], components });
  if (mode === "reactions") {
    for (const e of entries) if (e.emoji) await msg.react(e.emoji).catch(() => {});
  }
  const panels = featureData(channel.guild.id, "selfroles");
  panels[msg.id] = { channelId: channel.id, mode, exclusive, entries };
  saveFeatures();
  return msg;
}

// ---------- handlers ----------
async function applyChange(member, panel, wantIds) {
  const panelIds = panel.entries.map((e) => e.roleId);
  const add = wantIds.filter((id) => !member.roles.cache.has(id));
  const remove = panelIds.filter((id) => !wantIds.includes(id) && member.roles.cache.has(id));
  if (remove.length) await member.roles.remove(remove, "self-role panel");
  if (add.length) await member.roles.add(add, "self-role panel");
  const name = (id) => member.guild.roles.cache.get(id)?.name || id;
  const parts = [];
  if (add.length) parts.push(`Added: ${add.map(name).join(", ")}`);
  if (remove.length) parts.push(`Removed: ${remove.map(name).join(", ")}`);
  return parts.join("\n") || "No changes.";
}

export async function handleSelfRoleButton(interaction) {
  const roleId = interaction.customId.slice(3);
  const panel = featureData(interaction.guildId, "selfroles")[interaction.message.id];
  const member = interaction.member;
  if (roleId === "clear") {
    if (!panel) return interaction.reply({ content: "This panel is no longer active.", ephemeral: true });
    return interaction.reply({ content: await applyChange(member, panel, []), ephemeral: true });
  }
  const role = interaction.guild.roles.cache.get(roleId);
  if (!isSafeSelfRole(role) || (panel && !panel.entries.some((e) => e.roleId === roleId))) {
    return interaction.reply({ content: "That role can't be self-assigned.", ephemeral: true });
  }
  if (!panel) {
    // Panel made before tracking existed: plain toggle.
    const has = member.roles.cache.has(roleId);
    await (has ? member.roles.remove(roleId) : member.roles.add(roleId));
    return interaction.reply({ content: `${has ? "Removed" : "Added"} <@&${roleId}>`, ephemeral: true });
  }
  const has = member.roles.cache.has(roleId);
  let want;
  if (has) want = panel.entries.map((e) => e.roleId).filter((id) => id !== roleId && member.roles.cache.has(id));
  else want = panel.exclusive ? [roleId] : [...panel.entries.map((e) => e.roleId).filter((id) => member.roles.cache.has(id)), roleId];
  const summary = await applyChange(member, panel, want);
  return interaction.reply({ content: summary, ephemeral: true });
}

export async function handleSelfRoleSelect(interaction) {
  const panel = featureData(interaction.guildId, "selfroles")[interaction.message.id];
  if (!panel) return interaction.reply({ content: "This menu is no longer active.", ephemeral: true });
  const allowed = new Set(panel.entries.map((e) => e.roleId).filter((id) => isSafeSelfRole(interaction.guild.roles.cache.get(id))));
  // "Clear" wins over anything else picked; otherwise selecting replaces this panel's roles
  const want = interaction.values.includes("__clear") ? [] : interaction.values.filter((v) => allowed.has(v));
  const summary = await applyChange(interaction.member, panel, want);
  return interaction.reply({ content: summary, ephemeral: true });
}

function matchEmoji(entryEmoji, reactionEmoji) {
  if (!entryEmoji) return false;
  const id = entryEmoji.match(CUSTOM_EMOJI)?.[1];
  if (id) return reactionEmoji.id === id;
  return entryEmoji.replace(/️/g, "") === (reactionEmoji.name || "").replace(/️/g, "");
}

export async function handleReactionRole(reaction, user, added) {
  if (user.bot) return;
  if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
  const guild = reaction.message.guild;
  if (!guild) return;
  const panel = featureData(guild.id, "selfroles")[reaction.message.id];
  if (!panel || panel.mode !== "reactions") return;
  const entry = panel.entries.find((e) => matchEmoji(e.emoji, reaction.emoji));
  if (!entry || !isSafeSelfRole(guild.roles.cache.get(entry.roleId))) return;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;
  try {
    if (added) {
      if (panel.exclusive) {
        // Single-choice: drop the other roles and their reactions
        for (const e of panel.entries) {
          if (e.roleId === entry.roleId) continue;
          if (member.roles.cache.has(e.roleId)) await member.roles.remove(e.roleId).catch(() => {});
          const other = reaction.message.reactions.cache.find((r) => matchEmoji(e.emoji, r.emoji));
          if (other) await other.users.remove(user.id).catch(() => {});
        }
      }
      await member.roles.add(entry.roleId, "reaction role");
    } else {
      await member.roles.remove(entry.roleId, "reaction role");
    }
  } catch (err) {
    console.error("reaction role failed:", err.message);
  }
}

// ---------- verify ----------
export function verifyRole(guild) {
  return resolveRole(guild, "verify_role", ["verified", "member"]);
}

export async function postVerifyPanel(channel, role, text) {
  const embed = baseEmbed(COLORS.success)
    .setTitle("✅ Verification")
    .setDescription(text || `Click **Verify** below and complete the quick check to get access to the server.\n\nYou'll receive the <@&${role.id}> role.`);
  embed.data.timestamp = undefined;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("verify").setLabel("Verify").setEmoji("✅").setStyle(ButtonStyle.Success),
  );
  return channel.send({ embeds: [embed], components: [row] });
}


