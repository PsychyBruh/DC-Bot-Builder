import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { getSettings } from "../storage/serverSettings.js";

export const name = "settings";

const SETTING_LABELS = {
  auto_role: "Auto-Assign Role",
  welcome_channel: "Welcome Channel",
  welcome_message: "Welcome Message",
  goodbye_channel: "Goodbye Channel",
  goodbye_message: "Goodbye Message",
  member_role: "Member Role",
};

export async function execute(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("Only members with the **Administrator** permission can use this command.");
    return;
  }

  const guildSettings = getSettings(message.guild.id);
  const keys = Object.keys(guildSettings);

  if (keys.length === 0) {
    await message.reply("No custom settings configured. Tell me what you want to set up — e.g. *\"auto-assign the Member role to new members\"* or *\"send a welcome message in #general\"*.");
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("Server Settings")
    .setColor(0x5865F2)
    .setDescription(`**${message.guild.name}** — ${keys.length} setting(s) configured`)
    .setTimestamp();

  for (const key of keys) {
    const label = SETTING_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    embed.addFields({ name: label, value: `\`${guildSettings[key]}\``, inline: true });
  }

  await message.reply({ embeds: [embed] });
}
