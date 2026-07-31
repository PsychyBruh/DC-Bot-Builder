import { baseEmbed, COLORS, EMOJIS } from "./utils/embeds.js";
import { getSettings } from "../storage/serverSettings.js";

export const name = "settings";
export const description = "View current server settings";
export const usage = "!settings";
export const category = "admin";
export const adminOnly = true;

const LABELS = {
  auto_role: "Auto-Assign Role",
  welcome_channel: "Welcome Channel",
  welcome_message: "Welcome Message",
  goodbye_channel: "Goodbye Channel",
  goodbye_message: "Goodbye Message",
  member_role: "Member Role",
  log_channel: "Log Channel",
  ai_enabled: "AI Commands",
  private_category: "Private Room Category",
};

export async function execute(message, args) {
  const settings = getSettings(message.guild.id);
  const keys = Object.keys(settings);
  if (keys.length === 0) {
    const embed = baseEmbed(COLORS.warning)
      .setTitle("⚙️ Settings")
      .setDescription("No custom settings configured.\n\nUse **`!admin-panel`** for a visual setup, or `!chat set auto_role to <role>` to configure via chat.")
      .setFooter({ text: "Tip: try !admin-panel" });
    return message.reply({ embeds: [embed] });
  }
  const fields = keys.map((key) => ({
    name: LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: `\`${settings[key]}\``,
    inline: true,
  }));
  const embed = baseEmbed(COLORS.primary)
    .setTitle(`${EMOJIS.gear} Server Settings`)
    .setDescription(`**${message.guild.name}** — ${keys.length} setting(s)\n\nRun \`!admin-panel\` for a visual editor.`)
    .addFields(fields)
    .setFooter({ text: "Settings persist across restarts" });
  await message.reply({ embeds: [embed] });
}
