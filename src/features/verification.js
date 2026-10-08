import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder,
} from "discord.js";
import { createCanvas } from "@napi-rs/canvas";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { resolveRole, canManageRole, settingNum } from "./config.js";
import { getSettings } from "../storage/serverSettings.js";
import "./welcomeCard.js"; // registers the bundled font used for the captcha

// Fully automatic verification — no staff involvement.
//
// Settings (per server):
//   verify_mode            button | captcha (default) | roblox   ("roblox" = captcha + linked Roblox account)
//   verify_rules_question  optional question shown in the captcha form (e.g. "Where do you report bugs?")
//   verify_rules_answer    accepted answer(s), comma-separated (matched loosely)
//   min_account_age_days   Discord accounts younger than this can't verify yet (default 3, 0 = off)
//   roblox_min_age_days    roblox mode: Roblox account must be at least this old (default 30)
//   verify_kick_hours      kick members who haven't verified after this many hours (default 0 = off)
//
// Risky accounts (no avatar, default-looking name, joined during a join burst, young account)
// automatically get a longer captcha and must wait a few minutes after joining — never a staff queue.

const pending = new Map(); // `${guildId}:${userId}` -> { code, attempts, at, risky, stage, robloxCode, robloxId, robloxName }
const lockouts = new Map(); // `${guildId}:${userId}` -> until
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 10 * 60000;
const CODE_TTL_MS = 10 * 60000;

// ---------- risk ----------
export function riskReasons(member) {
  const reasons = [];
  const ageDays = (Date.now() - member.user.createdTimestamp) / 86400000;
  if (ageDays < 14) reasons.push("young account");
  if (!member.user.avatar) reasons.push("no avatar");
  if (/^[a-z]+[._-]?\d{4,}$/i.test(member.user.username) || /^user\d+/i.test(member.user.username)) reasons.push("default-style name");
  return reasons;
}

async function joinedDuringBurst(member) {
  const { featureData } = await import("./config.js");
  const raid = featureData(member.guild.id, "raid", { locked: false });
  return !!raid.lastBurstAt && Math.abs((member.joinedTimestamp || 0) - raid.lastBurstAt) < 5 * 60000;
}

// ---------- captcha image ----------
function makeCode(len) {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

export function renderCaptcha(code) {
  const W = 360, H = 120;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1e1f2b";
  ctx.fillRect(0, 0, W, H);
  // Noise: dots and curves behind and in front of the text
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `hsla(${Math.random() * 360},60%,70%,${0.15 + Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  const curve = () => {
    ctx.strokeStyle = `hsla(${Math.random() * 360},70%,65%,0.55)`;
    ctx.lineWidth = 1.5 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, Math.random() * H);
    ctx.bezierCurveTo(W / 3, Math.random() * H, (2 * W) / 3, Math.random() * H, W, Math.random() * H);
    ctx.stroke();
  };
  for (let i = 0; i < 3; i++) curve();
  const step = (W - 40) / code.length;
  for (let i = 0; i < code.length; i++) {
    ctx.save();
    ctx.translate(26 + i * step + Math.random() * 8, 70 + (Math.random() * 24 - 12));
    ctx.rotate((Math.random() - 0.5) * 0.7);
    ctx.font = `${40 + Math.floor(Math.random() * 14)}px PoppinsBold`;
    ctx.fillStyle = `hsl(${Math.random() * 360},75%,78%)`;
    ctx.fillText(code[i], 0, 0);
    ctx.restore();
  }
  for (let i = 0; i < 2; i++) curve();
  return c.toBuffer("image/png");
}

// ---------- flow ----------
export function verifyRoleFor(guild) {
  return resolveRole(guild, "verify_role", ["verified", "member"]);
}

async function grant(interaction, role) {
  const member = interaction.member;
  await member.roles.add(role, "passed verification");
  const unverified = resolveRole(interaction.guild, "unverified_role", ["unverified"]);
  if (unverified && member.roles.cache.has(unverified.id)) await member.roles.remove(unverified).catch(() => {});
  pending.delete(`${interaction.guildId}:${member.id}`);
  const { bump } = await import("./stats.js");
  bump(interaction.guildId, "verifications");
  const { postWelcome, sendWelcomeDm } = await import("./welcome.js");
  if (getSettings(interaction.guildId).welcome_on === "verify") postWelcome(member).catch(() => {});
  sendWelcomeDm(member).catch(() => {});
  const { logJoinLeave } = await import("./logging.js");
  logJoinLeave(interaction.guild, baseEmbed(COLORS.success).setTitle("✅ Member verified").setDescription(`${member} (${member.user.tag})`));
}

// Step 1: the Verify button on the panel.
export async function handleVerifyButton(interaction) {
  const guild = interaction.guild;
  const member = interaction.member;
  const s = getSettings(guild.id);
  const role = verifyRoleFor(guild);
  const key = `${guild.id}:${member.id}`;
  if (!role) return interaction.reply({ content: "Verification isn't set up yet — the server needs a verify role.", ephemeral: true });
  if (member.roles.cache.has(role.id)) return interaction.reply({ content: "You're already verified ✅", ephemeral: true });
  if (!canManageRole(guild, role)) return interaction.reply({ content: "I can't give the verified role — my role needs to be above it. Please tell an admin.", ephemeral: true });

  const { raidState } = await import("./safety.js");
  if (raidState(guild.id).locked) return interaction.reply({ content: "🔒 Verification is paused for a few minutes (raid protection). Please try again shortly.", ephemeral: true });

  const lockedUntil = lockouts.get(key);
  if (lockedUntil && lockedUntil > Date.now()) return interaction.reply({ content: `Too many wrong attempts — try again <t:${Math.floor(lockedUntil / 1000)}:R>.`, ephemeral: true });

  // Account-age gate: tell them exactly when they can verify instead of involving staff
  const minDays = settingNum(guild.id, "min_account_age_days", 3);
  const readyAt = member.user.createdTimestamp + minDays * 86400000;
  if (minDays > 0 && Date.now() < readyAt) {
    if ((s.verify_young_action || "wait") === "review") {
      const { requestAltApproval } = await import("./safety.js");
      const sent = await requestAltApproval(member);
      return interaction.reply({ content: sent ? "🕵️ Your account is too new — a staff member will check you shortly." : "⏳ You're already in the review queue — a staff member will check you shortly.", ephemeral: true });
    }
    return interaction.reply({ content: `🕒 Your Discord account is too new to verify here. You can verify <t:${Math.floor(readyAt / 1000)}:R> (accounts must be ${minDays}+ days old).`, ephemeral: true });
  }

  const reasons = riskReasons(member);
  if (await joinedDuringBurst(member)) reasons.push("joined during a join burst");
  const risky = reasons.length >= 2;
  // Risky accounts wait a few minutes after joining — stops join-and-instantly-verify bots
  if (risky && Date.now() - (member.joinedTimestamp || 0) < 5 * 60000) {
    const at = (member.joinedTimestamp || Date.now()) + 5 * 60000;
    return interaction.reply({ content: `⏳ Please read the rules first — you can verify <t:${Math.floor(at / 1000)}:R>.`, ephemeral: true });
  }

  let mode = (s.verify_mode || "captcha").toLowerCase();
  // captcha_below_days: only younger accounts get the captcha, older ones just click
  const captchaBelow = settingNum(guild.id, "captcha_below_days", 0);
  if (mode === "captcha" && captchaBelow > 0 && Date.now() - member.user.createdTimestamp >= captchaBelow * 86400000) mode = "button";
  if (mode === "button" && !risky && !s.verify_rules_question) {
    await grant(interaction, role);
    return interaction.reply({ content: `✅ Verified! You now have **${role.name}**.`, ephemeral: true });
  }

  const code = makeCode(risky ? 7 : 5);
  pending.set(key, { code, attempts: pending.get(key)?.attempts || 0, at: Date.now(), risky, stage: "captcha" });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("vfy:code").setLabel("Enter code").setEmoji("⌨️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("verify").setLabel("New code").setEmoji("🔄").setStyle(ButtonStyle.Secondary),
  );
  return interaction.reply({
    content: `Type the characters in the image (not case-sensitive).${mode === "roblox" ? "\nAfter this you'll link your Roblox account." : ""}`,
    files: [new AttachmentBuilder(renderCaptcha(code), { name: "captcha.png" })],
    components: [row],
    ephemeral: true,
  });
}

// Step 2: "Enter code" → modal with the code (and the rules question if set)
export async function handleCodeButton(interaction) {
  const key = `${interaction.guildId}:${interaction.user.id}`;
  const p = pending.get(key);
  if (!p || Date.now() - p.at > CODE_TTL_MS) return interaction.reply({ content: "That code expired — press **Verify** again.", ephemeral: true });
  const s = getSettings(interaction.guildId);
  const modal = new ModalBuilder().setCustomId("vfym:captcha").setTitle("Verification").addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("code").setLabel("Code from the image").setStyle(TextInputStyle.Short).setMinLength(4).setMaxLength(10).setRequired(true)),
  );
  if (s.verify_rules_question) {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("rules").setLabel(s.verify_rules_question.slice(0, 45)).setPlaceholder("Check the rules channel if you're not sure").setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)));
  }
  if ((s.verify_mode || "").toLowerCase() === "roblox") {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("roblox").setLabel("Your Roblox username").setStyle(TextInputStyle.Short).setMaxLength(20).setRequired(true)));
  }
  return interaction.showModal(modal);
}

const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function fail(interaction, key, p, why) {
  p.attempts += 1;
  if (p.attempts >= MAX_ATTEMPTS) {
    pending.delete(key);
    const until = Date.now() + LOCKOUT_MS;
    lockouts.set(key, until);
    return interaction.reply({ content: `❌ ${why} Too many attempts — try again <t:${Math.floor(until / 1000)}:R>.`, ephemeral: true });
  }
  return interaction.reply({ content: `❌ ${why} (${MAX_ATTEMPTS - p.attempts} attempt(s) left) — press **Verify** for a new code.`, ephemeral: true });
}

// Step 3: modal submit — check code + rules answer, then grant (or continue to Roblox linking)
export async function handleCaptchaModal(interaction) {
  const key = `${interaction.guildId}:${interaction.user.id}`;
  const p = pending.get(key);
  if (!p || Date.now() - p.at > CODE_TTL_MS) return interaction.reply({ content: "That code expired — press **Verify** again.", ephemeral: true });
  const s = getSettings(interaction.guildId);
  if (norm(interaction.fields.getTextInputValue("code")) !== norm(p.code)) return fail(interaction, key, p, "Wrong code.");
  if (s.verify_rules_question) {
    const answers = (s.verify_rules_answer || "").split(",").map(norm).filter(Boolean);
    const given = norm(interaction.fields.getTextInputValue("rules"));
    if (answers.length && !answers.some((a) => given.includes(a) || (a.includes(given) && given.length >= 3))) {
      return fail(interaction, key, p, "That's not the right answer — have a look at the rules.");
    }
  }
  const role = verifyRoleFor(interaction.guild);
  if ((s.verify_mode || "").toLowerCase() !== "roblox") {
    await grant(interaction, role);
    return interaction.reply({ content: `✅ Verified! Welcome — you now have **${role.name}**.`, ephemeral: true });
  }

  // Roblox mode: already linked? done. Otherwise start the profile-code link right here.
  const { getLink, startLink } = await import("./roblox.js");
  if (getLink(interaction.user.id) && await robloxOldEnough(interaction.guildId, getLink(interaction.user.id).robloxId)) {
    await grant(interaction, role);
    return interaction.reply({ content: `✅ Verified with your linked Roblox account! You now have **${role.name}**.`, ephemeral: true });
  }
  const res = await startLink(interaction.user.id, interaction.fields.getTextInputValue("roblox").trim()).catch((e) => ({ error: `Roblox didn't respond (${e.message}).` }));
  if (res.error) return interaction.reply({ content: `❌ ${res.error}`, ephemeral: true });
  p.stage = "roblox";
  p.at = Date.now();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("vfy:roblox").setLabel("I've added it").setEmoji("✅").setStyle(ButtonStyle.Success),
  );
  return interaction.reply({
    content: `Almost done! Put this in the **About** section of your Roblox profile (**${res.username}**), save, then press the button:\n\`\`\`${res.code}\`\`\`You can remove it afterwards.`,
    components: [row],
    ephemeral: true,
  });
}

async function robloxOldEnough(guildId, robloxId) {
  const minDays = settingNum(guildId, "roblox_min_age_days", 30);
  if (!minDays) return true;
  try {
    const u = await fetch(`https://users.roblox.com/v1/users/${robloxId}`, { signal: AbortSignal.timeout(10_000) }).then((r) => r.json());
    return Date.now() - new Date(u.created).getTime() >= minDays * 86400000;
  } catch { return true; } // don't block people because Roblox is down
}

// Step 4 (roblox mode): confirm the code is in their profile
export async function handleRobloxButton(interaction) {
  const key = `${interaction.guildId}:${interaction.user.id}`;
  const p = pending.get(key);
  if (!p || p.stage !== "roblox") return interaction.reply({ content: "Press **Verify** to start again.", ephemeral: true });
  const { finishLink, getLink } = await import("./roblox.js");
  const res = await finishLink(interaction.member).catch((e) => ({ error: `Roblox didn't respond (${e.message}).` }));
  if (res.error) return interaction.reply({ content: `❌ ${res.error}`, ephemeral: true });
  if (!(await robloxOldEnough(interaction.guildId, getLink(interaction.user.id).robloxId))) {
    pending.delete(key);
    const days = settingNum(interaction.guildId, "roblox_min_age_days", 30);
    return interaction.reply({ content: `🕒 Your Roblox account is linked, but it needs to be at least ${days} days old to verify here. Press **Verify** again once it is.`, ephemeral: true });
  }
  const role = verifyRoleFor(interaction.guild);
  await grant(interaction, role);
  return interaction.reply({ content: `✅ Verified and linked to **${res.username}**! You now have **${role.name}**.`, ephemeral: true });
}

// Scheduler: kick members who never verified (per-server verify_kick_hours)
export async function kickUnverified(client) {
  for (const guild of client.guilds.cache.values()) {
    const hours = settingNum(guild.id, "verify_kick_hours", 0);
    const role = verifyRoleFor(guild);
    if (!hours || !role) continue;
    const members = await guild.members.fetch().catch(() => null);
    if (!members) continue;
    for (const m of members.values()) {
      if (m.user.bot || m.roles.cache.has(role.id) || !m.kickable) continue;
      if (Date.now() - (m.joinedTimestamp || Date.now()) < hours * 3600000) continue;
      // Members who already had other roles (staff-added, older members) are left alone
      if (m.roles.cache.filter((r) => r.id !== guild.id && r.name.toLowerCase() !== "unverified").size > 0) continue;
      await m.send(`You were removed from **${guild.name}** because you didn't verify within ${hours} hours. You're welcome to rejoin and verify any time.`).catch(() => {});
      await m.kick(`didn't verify within ${hours}h`).catch(() => {});
    }
  }
}
