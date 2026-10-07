import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from "discord.js";
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
      entries.map((e) => `${e.emoji ? e.emoji + " " : "• "}<@&${e.roleId}>`).join("\n") +
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
  } else if (mode === "dropdown") {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("srsel")
      .setPlaceholder(exclusive ? "Choose one…" : "Choose any…")
      .setMinValues(0)
      .setMaxValues(exclusive ? 1 : entries.length)
      .addOptions(entries.map((e) => {
        const o = { label: e.label.slice(0, 100), value: e.roleId };
        if (e.emoji) o.emoji = emojiForComponent(e.emoji);
        return o;
      }));
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
  const allowed = new Set(panel.entries.map((e) => e.roleId));
  const want = interaction.values.filter((v) => allowed.has(v));
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
  if (!entry) return;
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
    .setDescription(text || `Click **Verify** below to get access to the server.\n\nYou'll receive the <@&${role.id}> role.`);
  embed.data.timestamp = undefined;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("verify").setLabel("Verify").setEmoji("✅").setStyle(ButtonStyle.Success),
  );
  return channel.send({ embeds: [embed], components: [row] });
}

export async function handleVerifyButton(interaction) {
  const role = verifyRole(interaction.guild);
  if (!role) return interaction.reply({ content: "Verification isn't set up yet — ask an admin to run `!setup verify_role @role`.", ephemeral: true });
  const member = interaction.member;
  if (member.roles.cache.has(role.id)) return interaction.reply({ content: `You're already verified.`, ephemeral: true });
  if (!canManageRole(interaction.guild, role)) return interaction.reply({ content: "I can't give that role — my role needs to be above it.", ephemeral: true });
  const { raidState, needsAltReview, requestAltApproval } = await import("./safety.js");
  if (raidState(interaction.guildId).locked) {
    return interaction.reply({ content: "🔒 Verification is temporarily locked (raid protection). Please try again in a few minutes.", ephemeral: true });
  }
  if (needsAltReview(member)) {
    const sent = await requestAltApproval(member);
    return interaction.reply({ content: sent ? "🕵️ Your account is very new, so a staff member will review your verification shortly." : "⏳ Your verification is waiting for staff review.", ephemeral: true });
  }
  await member.roles.add(role, "verified via button");
  const unverified = resolveRole(interaction.guild, "unverified_role", ["unverified"]);
  if (unverified && member.roles.cache.has(unverified.id)) await member.roles.remove(unverified).catch(() => {});
  const { logJoinLeave } = await import("./logging.js");
  logJoinLeave(interaction.guild, baseEmbed(COLORS.success).setTitle("✅ Member verified").setDescription(`${member} (${member.user.tag})`));
  return interaction.reply({ content: `✅ Verified! Welcome — you now have **${role.name}**.`, ephemeral: true });
}

