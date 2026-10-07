import { baseEmbed, COLORS } from "../utils/embeds.js";
import { getRankConfig, setRankRole, removeRankRole, syncRanks } from "../../features/levels.js";
import { canManageRole, saveFeatures } from "../../features/config.js";

export const name = "rankroles";
export const description = "Roles given automatically at XP levels (with optional perk text / coin reward)";
export const usage = "!rankroles add <level> @role [coins] [perk text]  |  !rankroles remove <level>  |  !rankroles list  |  !rankroles sync  |  !rankroles stack on|off";
export const category = "admin";
export const adminOnly = true;

export async function execute(message, args) {
  const sub = (args[0] || "list").toLowerCase();
  const cfg = getRankConfig(message.guild.id);
  if (sub === "add") {
    const level = parseInt(args[1], 10);
    const role = message.mentions.roles.first();
    if (!Number.isInteger(level) || level < 1 || !role) return message.reply("Usage: `!rankroles add <level> @role [coins] [perk text]`");
    if (!canManageRole(message.guild, role)) return message.reply(`I can't give **${role.name}** — move my role above it.`);
    const rest = args.slice(2).filter((a) => !/^<@&\d+>$/.test(a));
    const coins = /^\d+$/.test(rest[0] || "") ? parseInt(rest.shift(), 10) : 0;
    setRankRole(message.guild.id, level, role.id, { coins, perk: rest.join(" ").slice(0, 120) || null });
    return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ Level **${level}** → ${role}${coins ? ` (+${coins} coins)` : ""}. Run \`!rankroles sync\` to apply to existing members.`)], allowedMentions: { parse: [] } });
  }
  if (sub === "remove") {
    const ok = removeRankRole(message.guild.id, parseInt(args[1], 10));
    return message.reply(ok ? "✅ Removed." : "No rank at that level.");
  }
  if (sub === "stack") {
    cfg.stack = /^(on|true|yes)$/i.test(args[1] || "");
    saveFeatures();
    return message.reply(cfg.stack ? "Members keep all rank roles they've earned." : "Members only keep their highest rank role.");
  }
  if (sub === "sync") {
    const status = await message.reply("⏳ Syncing rank roles…");
    const n = await syncRanks(message.guild);
    return status.edit(`✅ Synced — ${n} role(s) given.`);
  }
  const lines = cfg.list.map((r) => `Lv **${r.level}** → <@&${r.roleId}>${r.coins ? ` · 🪙 ${r.coins}` : ""}${r.perk ? ` · ${r.perk}` : ""}`);
  return message.reply({ embeds: [baseEmbed(COLORS.purple).setTitle("🏅 Rank roles").setDescription(lines.join("\n") || "None yet. `!rankroles add 5 @Rookie`")
    .setFooter({ text: cfg.stack ? "Stacking: on" : "Stacking: off (highest only)" })], allowedMentions: { parse: [] } });
}
