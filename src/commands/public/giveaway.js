import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { adjustBalance, getUser } from "../../storage/users.js";
import {
  createGiveaway, getGiveaway, endGiveaway, removeGiveaway, getActiveGiveaways, getAllGiveaways,
  toggleGiveawayEntry, findGiveawayByMessage, updateGiveaway,
} from "../../storage/giveaways.js";
import { isStaff, memberAllowed, resolveChannel, resolveRole } from "../../features/config.js";

export const name = "giveaway";
export const description = "Host a giveaway. Coins (you fund it) or any prize (staff).";
export const usage = "!giveaway <coins> <winners> <duration>  |  !giveaway prize <duration> <winners> <prize…> [@required-role]  |  !giveaway end|reroll <messageId>";
export const category = "economy";

const KEEP_ENDED_MS = 7 * 86400000; // ended giveaways stay rerollable for a week

export function parseDuration(s) {
  if (typeof s !== "string") return null;
  const m = /^(\d+)(s|m|h|d|w)$/i.exec(s.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[m[2].toLowerCase()];
}

function prizeText(g) {
  return g.kind === "prize" ? g.prize : `${g.amount.toLocaleString()} coins`;
}

function giveawayEmbed(g, hostName) {
  const lines = [
    `**Prize:** ${prizeText(g)}${g.winners > 1 ? ` × **${g.winners}** winners` : ""}`,
    `**Hosted by:** ${hostName ? hostName : `<@${g.hostId}>`}`,
    g.requiredRoleId ? `**Must have:** <@&${g.requiredRoleId}> or higher` : null,
    g.ended ? `**Ended** <t:${Math.floor(g.endsAt / 1000)}:R>` : `**Ends** <t:${Math.floor(g.endsAt / 1000)}:R>`,
    g.ended
      ? `\n**Winner${(g.winnerIds || []).length === 1 ? "" : "s"}:** ${(g.winnerIds || []).length ? g.winnerIds.map((id) => `<@${id}>`).join(", ") : "nobody entered"}`
      : "\nClick **Enter** to join (click again to leave).",
  ].filter(Boolean);
  return baseEmbed(g.ended ? COLORS.dark : COLORS.gold).setTitle(`🎉 ${g.kind === "prize" ? g.prize.slice(0, 200) : "Coin Giveaway"}`).setDescription(lines.join("\n"))
    .setFooter({ text: `${(g.entries || []).length} entr${(g.entries || []).length === 1 ? "y" : "ies"}${g.kind === "coins" ? " • host can't win" : ""}` });
}

function entryRow(g) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("gw:enter").setLabel(g.ended ? "Ended" : "Enter").setEmoji("🎉").setStyle(ButtonStyle.Secondary).setDisabled(!!g.ended),
  );
  if (g.ended && g.kind === "prize") row.addComponents(new ButtonBuilder().setCustomId("gw:reroll").setLabel("Reroll").setStyle(ButtonStyle.Secondary));
  return row;
}

async function reroll(guild, g) {
  const pool = (g.entries || []).filter((id) => !(g.winnerIds || []).includes(id));
  if (!pool.length) return null;
  const winner = pool[Math.floor(Math.random() * pool.length)];
  updateGiveaway(g.id, { winnerIds: [...(g.winnerIds || []), winner] });
  const u = await guild.client.users.fetch(winner).catch(() => null);
  if (u) await u.send(`🎉 You won **${g.prize}** in **${guild.name}** (reroll)! Watch for a message from staff.`).catch(() => {});
  return winner;
}

export async function handleRerollButton(interaction) {
  const g = findGiveawayByMessage(interaction.message.id);
  if (!g) return interaction.reply({ content: "Giveaway not found.", ephemeral: true });
  if (g.hostId !== interaction.user.id && !memberAllowed(interaction.member, "giveaway_host_roles", null)) return interaction.reply({ content: "Only the host or staff can reroll.", ephemeral: true });
  const winner = await reroll(interaction.guild, g);
  if (!winner) return interaction.reply({ content: "No other entrants to pick from.", ephemeral: true });
  return interaction.reply({ content: `🎉 New winner for **${g.prize}**: <@${winner}>!`, allowedMentions: { users: [winner] } });
}

export async function execute(message, args) {
  const sub = (args[0] || "").toLowerCase();

  // ----- end early / reroll (host or staff) -----
  if (sub === "end" || sub === "reroll") {
    const g = findGiveawayByMessage(args[1]);
    if (!g || g.guildId !== message.guild.id) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Giveaway not found. Use the giveaway message's ID.")] });
    if (g.hostId !== message.author.id && !isStaff(message.member)) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Only the host or staff can do that.")] });
    if (sub === "end") {
      if (g.ended) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("That giveaway already ended.")] });
      await finishGiveaway(message.client, g.id);
      return message.react("✅").catch(() => {});
    }
    if (!g.ended) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("That giveaway hasn't ended yet.")] });
    if (g.kind !== "prize") return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("Coin giveaways pay out automatically and can't be rerolled.")] });
    const winner = await reroll(message.guild, g);
    if (!winner) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("No other entrants to pick from.")] });
    return message.channel.send({ content: `🎉 New winner for **${g.prize}**: <@${winner}>!`, allowedMentions: { users: [winner] } });
  }

  // ----- custom prize (staff) -----
  if (sub === "prize") {
    if (!memberAllowed(message.member, "giveaway_host_roles", null)) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ You can't host prize giveaways. Anyone can host a coin giveaway: `!giveaway <coins> <winners> <duration>`")] });
    const dur = parseDuration(args[1]);
    const winners = parseInt(args[2], 10);
    const requiredRole = message.mentions.roles.first();
    const prize = args.slice(3).filter((a) => !/^<@&\d+>$/.test(a)).join(" ").trim();
    if (!dur || dur < 10000 || dur > 30 * 86400000 || !winners || winners < 1 || winners > 50 || !prize) {
      return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Usage: `!giveaway prize <duration> <winners> <prize> [@required-role]`\nExample: `!giveaway prize 2d 1 Nitro Classic`")] });
    }
    const target = resolveChannel(message.guild, "giveaway_channel", []) || message.channel;
    const g = { guildId: message.guild.id, channelId: target.id, hostId: message.author.id, kind: "prize", prize: prize.slice(0, 200), winners, endsAt: Date.now() + dur, requiredRoleId: requiredRole?.id || null };
    return launch(message, g);
  }

  // ----- coin giveaway (anyone; host pays) -----
  if (!(await applyCooldown(message, "giveaway", "economy"))) return;
  const amount = parseInt(args[0], 10);
  const winners = parseInt(args[1], 10);
  const dur = parseDuration(args[2]);
  if (!amount || amount < 1 || !winners || winners < 1 || !dur || dur < 10000 || dur > 7 * 86400000) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Usage: `!giveaway <coins> <winners> <duration>` (e.g. `!giveaway 100 1 1h`)\nStaff: `!giveaway prize <duration> <winners> <prize>`")] });
  }
  if (winners > 20) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Max 20 winners.")] });
  const totalCost = amount * winners;
  const user = getUser(message.author.id);
  if ((user.balance || 0) < totalCost) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Need ${totalCost} coins. You have ${user.balance || 0}.`)] });
  }
  adjustBalance(message.author.id, -totalCost);
  return launch(message, { guildId: message.guild.id, channelId: message.channelId, hostId: message.author.id, kind: "coins", amount, winners, endsAt: Date.now() + dur });
}

async function launch(message, data) {
  const preview = { ...data, entries: [], ended: false };
  const channel = message.guild.channels.cache.get(data.channelId) || message.channel;
  const ping = data.kind === "prize" ? resolveRole(message.guild, "giveaway_ping_role", ["giveaway ping"]) : null;
  const m = await channel.send({ content: ping ? `${ping}` : undefined, embeds: [giveawayEmbed(preview, message.author.username)], components: [entryRow(preview)], allowedMentions: { roles: ping ? [ping.id] : [] } });
  if (channel.id !== message.channelId) await message.reply(`🎉 Giveaway posted in ${channel}.`).catch(() => {});
  const g = createGiveaway({ ...data, messageId: m.id, hostName: message.author.username });
  scheduleEnd(message.client, g);
  if (message.deletable && data.kind === "prize") await message.delete().catch(() => {});
}

// Button: toggle entry
export async function handleGiveawayButton(interaction) {
  const g = findGiveawayByMessage(interaction.message.id);
  if (!g || g.ended) return interaction.reply({ content: "This giveaway has ended.", ephemeral: true });
  if (g.kind === "coins" && interaction.user.id === g.hostId) return interaction.reply({ content: "You can't enter your own coin giveaway.", ephemeral: true });
  const req = g.requiredRoleId ? interaction.guild.roles.cache.get(g.requiredRoleId) : null;
  if (req && !interaction.member.roles.cache.has(req.id) && interaction.member.roles.highest.position < req.position) {
    return interaction.reply({ content: `You need the <@&${g.requiredRoleId}> role to enter.`, ephemeral: true });
  }
  const entered = toggleGiveawayEntry(g.id, interaction.user.id);
  await interaction.update({ embeds: [giveawayEmbed(getGiveaway(g.id), g.hostName)], components: [entryRow(g)] });
  return interaction.followUp({ content: entered ? "🎉 You're entered! Good luck." : "You left the giveaway.", ephemeral: true });
}

function scheduleEnd(client, g) {
  // setTimeout can't hold more than ~24.8 days; long giveaways re-check periodically.
  const delay = Math.min(Math.max(0, g.endsAt - Date.now()), 2 ** 31 - 1);
  setTimeout(() => {
    const cur = getGiveaway(g.id);
    if (!cur || cur.ended) return;
    if (cur.endsAt > Date.now()) return scheduleEnd(client, cur);
    finishGiveaway(client, g.id).catch((e) => console.error("giveaway end failed:", e.message));
  }, delay);
}

async function finishGiveaway(client, id) {
  const g = getGiveaway(id);
  if (!g || g.ended) return;
  endGiveaway(id); // mark first so a double-fire can't pay twice
  let m = null;
  try {
    const channel = await client.channels.fetch(g.channelId);
    m = await channel.messages.fetch(g.messageId);
  } catch {}
  let ids = [...(g.entries || [])];
  // Giveaways started before the button existed used a 🎉 reaction
  if (!ids.length) {
    try {
      const reaction = m?.reactions.cache.get("🎉");
      if (reaction) ids = [...(await reaction.users.fetch()).values()].filter((u) => !u.bot).map((u) => u.id);
    } catch {}
  }
  if (g.kind === "coins") ids = ids.filter((uid) => uid !== g.hostId);
  const winnerIds = [];
  const pool = [...ids];
  for (let i = 0; i < g.winners && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winnerIds.push(pool.splice(idx, 1)[0]);
  }
  if (g.kind === "coins" || !g.kind) {
    winnerIds.forEach((uid) => adjustBalance(uid, g.amount));
    const refund = (g.winners - winnerIds.length) * g.amount; // unfilled slots go back to the host
    if (refund > 0) adjustBalance(g.hostId, refund);
  }
  const done = updateGiveaway(id, { winnerIds, endsAt: Date.now(), kind: g.kind || "coins" });
  if (!m) return;
  await m.edit({ embeds: [giveawayEmbed(done, g.hostName)], components: [entryRow(done)] }).catch(() => {});
  for (const uid of winnerIds) {
    const u = await client.users.fetch(uid).catch(() => null);
    if (u) await u.send(`🎉 You won **${prizeText(done)}** in **${m.guild.name}**!${done.kind === "prize" ? " Watch for a message from staff." : " The coins are in your wallet."}`).catch(() => {});
  }
  await m.reply({
    content: winnerIds.length ? `🎉 Congratulations ${winnerIds.map((u) => `<@${u}>`).join(", ")}! You won **${prizeText(done)}**!` : "Nobody entered this giveaway.",
    allowedMentions: { users: winnerIds },
  }).catch(() => {});
}

// Called once on startup: reschedule giveaways that survived a restart, drop old finished ones.
export function resumeGiveaways(client) {
  for (const g of getAllGiveaways()) {
    if (g.ended && Date.now() - (g.endsAt || 0) > KEEP_ENDED_MS) removeGiveaway(g.id);
  }
  for (const g of getActiveGiveaways()) {
    if (g.messageId && g.hostId) scheduleEnd(client, g);
  }
}
