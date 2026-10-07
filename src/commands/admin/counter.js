import { baseEmbed, COLORS } from "../utils/embeds.js";
import { createCounter, updateCounters } from "../../features/automation.js";
import { featureData, saveFeatures } from "../../features/config.js";

export const name = "counter";
export const description = "Voice channels that show live counts (members, humans, bots, boosts, a role)";
export const usage = "!counter add <members|humans|bots|boosts|role @role> <template with {count}>  |  !counter list  |  !counter remove #channel";
export const category = "admin";
export const adminOnly = true;

const DEFAULTS = { members: "👥 Members: {count}", humans: "🙂 Humans: {count}", bots: "🤖 Bots: {count}", boosts: "🚀 Boosts: {count}", role: "🏷️ {count}" };

export async function execute(message, args) {
  const sub = (args[0] || "list").toLowerCase();
  const list = featureData(message.guild.id, "counters", []);
  if (sub === "add") {
    const kind = (args[1] || "").toLowerCase();
    if (!DEFAULTS[kind]) return message.reply(`Usage: \`${usage}\``);
    const role = message.mentions.roles.first();
    if (kind === "role" && !role) return message.reply("Mention the role to count, e.g. `!counter add role @Testers 🧪 Testers: {count}`");
    let template = args.slice(2).filter((a) => !/^<@&\d+>$/.test(a)).join(" ").trim() || (kind === "role" ? `${role.name}: {count}` : DEFAULTS[kind]);
    if (!template.includes("{count}")) template += " {count}";
    const ch = await createCounter(message.guild, kind, template.slice(0, 90), role?.id);
    return message.reply(`✅ Created ${ch} — updates every 10 minutes.`);
  }
  if (sub === "remove") {
    const ch = message.mentions.channels.first();
    const i = list.findIndex((c) => c.channelId === ch?.id);
    if (i < 0) return message.reply("That channel isn't a counter.");
    list.splice(i, 1);
    saveFeatures();
    await ch.delete().catch(() => {});
    return message.reply("✅ Counter removed.");
  }
  if (sub === "refresh") { await updateCounters(message.guild); return message.react("✅").catch(() => {}); }
  return message.reply({ embeds: [baseEmbed(COLORS.info).setTitle("📊 Counter channels").setDescription(list.map((c) => `<#${c.channelId}> — ${c.kind}${c.roleId ? ` <@&${c.roleId}>` : ""}`).join("\n") || "None. `!counter add members`")], allowedMentions: { parse: [] } });
}
