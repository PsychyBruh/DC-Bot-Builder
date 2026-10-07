import { baseEmbed, COLORS } from "../utils/embeds.js";
import { postVerifyPanel, verifyRole, postSelfRolePanel, parseRoleEntries } from "../../features/roles.js";
import { postTicketPanel } from "../../features/tickets.js";
import { postApplicationPanel } from "../../features/applications.js";
import { resolveChannel, canManageRole } from "../../features/config.js";
import { setSetting } from "../../storage/serverSettings.js";

export const name = "panel";
export const description = "Post a verify / ticket / application / self-role panel";
export const usage = "!panel verify [#channel] [@role]  |  !panel tickets [#channel]  |  !panel applications [#channel]  |  !panel roles <buttons|dropdown|reactions> [single] [#channel] <Title> | 🎮 @Role, 🕹️ @Role2";
export const category = "admin";
export const adminOnly = true;

export async function execute(message, args) {
  const kind = (args[0] || "").toLowerCase();
  const target = message.mentions.channels.first();
  const err = (t) => message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ ${t}`)] });
  const ok = (t) => message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ ${t}`)], allowedMentions: { parse: [] } });

  if (kind === "verify") {
    const role = message.mentions.roles.first() || verifyRole(message.guild);
    if (!role) return err("Mention the role to give, e.g. `!panel verify #verify @Member` (or set `verify_role`).");
    if (!canManageRole(message.guild, role)) return err(`I can't give **${role.name}** — move my role above it.`);
    const ch = target || resolveChannel(message.guild, null, ["verify", "verification"]) || message.channel;
    await postVerifyPanel(ch, role);
    setSetting(message.guild.id, "verify_role", role.id);
    return ok(`Verify panel posted in ${ch} — gives ${role}.`);
  }
  if (kind === "tickets" || kind === "ticket") {
    const ch = target || resolveChannel(message.guild, null, ["create-ticket", "tickets", "support"]) || message.channel;
    await postTicketPanel(ch);
    return ok(`Ticket panel posted in ${ch}.`);
  }
  if (kind === "applications" || kind === "apply" || kind === "apps") {
    const ch = target || resolveChannel(message.guild, null, ["apply", "join-the-team", "applications"]) || message.channel;
    await postApplicationPanel(ch);
    return ok(`Application panel posted in ${ch}.`);
  }
  if (kind === "roles" || kind === "selfroles") {
    const mode = (args[1] || "").toLowerCase();
    if (!["buttons", "dropdown", "reactions"].includes(mode)) return err("Usage: `!panel roles <buttons|dropdown|reactions> [single] [#channel] <Title> | 🎮 @Role, 🕹️ @Role2`");
    const lower = message.content.toLowerCase();
    let rest = message.content.slice(lower.indexOf(mode, lower.indexOf("roles")) + mode.length);
    const exclusive = /^\s*(single|exclusive|one)\b/i.test(rest);
    rest = rest.replace(/^\s*(single|exclusive|one)\b/i, "").replace(/^\s*<#\d+>/, "");
    const bar = rest.indexOf("|");
    if (bar < 0) return err("Add the roles after a `|`, e.g. `!panel roles buttons Platforms | 💻 @PC, 🎮 @Console`");
    const { entries, errors } = parseRoleEntries(message.guild, rest.slice(bar + 1));
    if (!entries.length) return err(`No usable roles. ${errors.join("; ")}`);
    if (mode === "reactions" && entries.some((e) => !e.emoji)) return err("Reaction panels need an emoji before every role.");
    if (entries.length > 25) return err("Max 25 roles per panel.");
    const ch = target || message.channel;
    await postSelfRolePanel(ch, { mode, title: rest.slice(0, bar).trim() || "Pick your roles", exclusive, entries });
    return ok(`${mode} role panel posted in ${ch} with ${entries.length} role(s).${errors.length ? `\n⚠️ Skipped: ${errors.join("; ")}` : ""}`);
  }
  return err(`Usage:\n${usage.split("  |  ").map((u) => `\`${u.trim()}\``).join("\n")}`);
}
