import { baseEmbed, COLORS } from "../utils/embeds.js";
import { getSettings, setSetting, removeSetting } from "../../storage/serverSettings.js";
import { SETTING_KEYS } from "../../features/settingsKeys.js";
import { resolveChannel, resolveRole } from "../../features/config.js";

export const name = "setup";
export const description = "View or change this server's feature settings";
export const usage = "!setup [group]  |  !setup <key> <value|#channel|@role>  |  !setup unset <key>";
export const category = "admin";
export const adminOnly = true;

// Turn "#channel", "@role", "<#id>" into a stored ID; plain text stays as-is.
export function normalizeSettingValue(key, raw, mentions = {}) {
  const def = SETTING_KEYS[key];
  raw = String(raw).trim();
  if (!def) return raw;
  if (def.type === "channel") return mentions.channel || raw.replace(/^<#(\d+)>$/, "$1").replace(/^#/, "");
  if (def.type === "role") return mentions.role || raw.replace(/^<@&(\d+)>$/, "$1").replace(/^@/, "");
  if (def.type === "toggle") return /^(on|true|yes|enable|enabled|1)$/i.test(raw) ? "true" : "false";
  if (def.type === "list") return raw.split(/[,\s]+/).map((s) => s.replace(/^<#(\d+)>$/, "$1").replace(/^#/, "")).filter(Boolean).join(",");
  return raw;
}

const fallbacks = (def) => (def.fallback || "").split(",").map((s) => s.trim()).filter(Boolean);

export function showSetting(guild, key, val) {
  const def = SETTING_KEYS[key];
  if (def?.type === "channel") {
    const ch = resolveChannel(guild, key, fallbacks(def));
    return val ? `<#${val}>` : ch ? `${ch} *(auto)*` : "—";
  }
  if (def?.type === "role") {
    const r = resolveRole(guild, key, fallbacks(def));
    return val ? `<@&${val}>` : r ? `${r} *(auto)*` : "—";
  }
  return val ? `\`${String(val).slice(0, 60)}\`` : "—";
}

export async function execute(message, args) {
  const settings = getSettings(message.guild.id);
  const groups = [...new Set(Object.values(SETTING_KEYS).map((d) => d.group))];
  const first = (args[0] || "").toLowerCase();

  if (!first || groups.some((g) => g.toLowerCase() === first)) {
    const pick = first ? groups.filter((g) => g.toLowerCase() === first) : groups;
    const embed = baseEmbed(COLORS.primary).setTitle(`⚙️ Server setup${first ? ` — ${pick[0]}` : ""}`);
    if (!first) embed.setDescription(`Run \`!setup <group>\` for descriptions, \`!setup <key> <value>\` to change one — or just tell \`!chat\` what you want.`);
    for (const g of pick) {
      const lines = Object.entries(SETTING_KEYS).filter(([, d]) => d.group === g)
        .map(([k, d]) => `\`${k}\` → ${showSetting(message.guild, k, settings[k])}${first ? `\n  ↳ ${d.desc}` : ""}`);
      // Split long groups across several fields (1024-char limit each)
      let chunk = "";
      let part = 0;
      for (const line of lines) {
        if ((chunk + "\n" + line).length > 1000) { embed.addFields({ name: part++ ? `${g} (cont.)` : g, value: chunk }); chunk = ""; }
        chunk += (chunk ? "\n" : "") + line;
      }
      if (chunk) embed.addFields({ name: part ? `${g} (cont.)` : g, value: chunk });
    }
    return message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  }

  if (first === "unset") {
    const key = args[1];
    if (!key) return message.reply("Usage: `!setup unset <key>`");
    removeSetting(message.guild.id, key);
    return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ Cleared \`${key}\` (falls back to the default).`)] });
  }

  const key = first;
  if (!SETTING_KEYS[key]) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Unknown setting \`${key}\`. Run \`!setup\` to see them all.`)] });
  const raw = args.slice(1).join(" ").trim();
  if (!raw) return message.reply({ embeds: [baseEmbed(COLORS.info).setDescription(`**${key}** — ${SETTING_KEYS[key].desc}\nCurrent: ${showSetting(message.guild, key, settings[key])}`)], allowedMentions: { parse: [] } });
  const value = normalizeSettingValue(key, raw, { channel: message.mentions.channels.first()?.id, role: message.mentions.roles.first()?.id });
  setSetting(message.guild.id, key, value);
  return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ \`${key}\` → ${showSetting(message.guild, key, value)}`)], allowedMentions: { parse: [] } });
}
