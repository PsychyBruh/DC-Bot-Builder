import { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getSettings, setSetting, removeSetting } from "../../storage/serverSettings.js";
import { getAllRooms } from "../../storage/privateRooms.js";
import { getUser } from "../../storage/users.js";

export const name = "admin-panel";
export const description = "Beautiful admin panel for the bot (ephemeral)";
export const usage = "!admin-panel";
export const category = "admin";
export const adminOnly = true;

const PANELS = {
  home: { emoji: "🏠", name: "Home" },
  settings: { emoji: "⚙️", name: "Settings" },
  roles: { emoji: "🎭", name: "Auto Roles" },
  welcome: { emoji: "👋", name: "Welcome" },
  channels: { emoji: "📺", name: "Channels" },
  ai: { emoji: "🤖", name: "AI" },
  stats: { emoji: "📊", name: "Stats" },
};

const SETTINGS_DEFS = [
  { key: "auto_role", label: "Auto Role", type: "role" },
  { key: "member_role", label: "Member Role", type: "role" },
  { key: "welcome_channel", label: "Welcome Channel", type: "channel" },
  { key: "welcome_message", label: "Welcome Message", type: "text", placeholder: "Welcome {user} to {server}!" },
  { key: "goodbye_channel", label: "Goodbye Channel", type: "channel" },
  { key: "goodbye_message", label: "Goodbye Message", type: "text" },
  { key: "ai_enabled", label: "AI Commands Enabled", type: "toggle" },
  { key: "log_channel", label: "Log Channel", type: "channel" },
];

export async function execute(message, { client }) {
  const panel = buildHomePanel(message.guild, client);
  await message.reply({ embeds: [panel.embed], components: panel.rows, ephemeral: true });
}

function buildHomePanel(guild, client) {
  const settings = getSettings(guild.id);
  const embed = baseEmbed(COLORS.primary)
    .setTitle(`${EMOJIS.sparkle} Project Nova — Admin Panel`)
    .setDescription(`Configure your bot visually. Click a category below.\n\n**Server:** ${guild.name}\n**Settings:** ${Object.keys(settings).length} configured`)
    .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }));

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ap_settings_${Date.now()}`).setLabel("⚙️ Settings").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ap_roles_${Date.now()}`).setLabel("🎭 Auto Roles").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ap_welcome_${Date.now()}`).setLabel("👋 Welcome").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ap_channels_${Date.now()}`).setLabel("📺 Channels").setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ap_ai_${Date.now()}`).setLabel("🤖 AI").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ap_stats_${Date.now()}`).setLabel("📊 Stats").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ap_logout_${Date.now()}`).setLabel("🚪 Close").setStyle(ButtonStyle.Danger),
  );
  return { embed, rows: [row1, row2] };
}

function buildSettingsPanel(guild) {
  const settings = getSettings(guild.id);
  const fields = SETTINGS_DEFS.map((def) => {
    const val = settings[def.key];
    const status = val ? `✅ \`${val}\`` : "⚪ Not set";
    return { name: def.label, value: status, inline: true };
  });
  const embed = baseEmbed(COLORS.primary)
    .setTitle("⚙️ Server Settings")
    .setDescription("Current configuration. Use the buttons below to toggle or set values.")
    .addFields(fields)
    .setFooter({ text: "Use the chat to set values: !chat set welcome_message to Welcome {user}!" });

  const row1 = new ActionRowBuilder();
  const row2 = new ActionRowBuilder();
  const row3 = new ActionRowBuilder();
  const rows = [row1, row2, row3];
  for (let i = 0; i < SETTINGS_DEFS.length; i++) {
    const def = SETTINGS_DEFS[i];
    const btn = new ButtonBuilder()
      .setCustomId(`ap_set_${def.key}_${Date.now()}`)
      .setLabel(def.label.length > 25 ? def.label.slice(0, 25) : def.label)
      .setStyle(def.type === "toggle" ? (settings[def.key] === "true" ? ButtonStyle.Success : ButtonStyle.Secondary) : ButtonStyle.Secondary);
    rows[Math.floor(i / 5)].addComponents(btn);
  }
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ap_home_${Date.now()}`).setLabel("⬅️ Back").setStyle(ButtonStyle.Primary),
  );
  rows.push(backRow);
  return { embed, rows };
}

function buildStatsPanel(guild, client) {
  const settings = getSettings(guild.id);
  const rooms = getAllRooms().filter((r) => r.guildId === guild.id).length;
  const memberCount = guild.memberCount;
  const channels = guild.channels.cache.size;
  const roles = guild.roles.cache.size;
  const embed = baseEmbed(COLORS.info)
    .setTitle("📊 Server Stats")
    .addFields(
      { name: "👥 Members", value: `${memberCount}`, inline: true },
      { name: "💬 Channels", value: `${channels}`, inline: true },
      { name: "🎭 Roles", value: `${roles}`, inline: true },
      { name: "🔒 Private Rooms", value: `${rooms}`, inline: true },
      { name: "⚙️ Settings", value: `${Object.keys(settings).length}`, inline: true },
      { name: "🤖 Bot Latency", value: `${Math.round(client.ws.ping)}ms`, inline: true },
    )
    .setFooter({ text: `${guild.name}` });
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ap_home_${Date.now()}`).setLabel("⬅️ Back").setStyle(ButtonStyle.Primary),
  );
  return { embed, rows: [backRow] };
}

function buildInfoPanel(guild, settingsKey) {
  const settings = getSettings(guild.id);
  const val = settings[settingsKey];
  const def = SETTINGS_DEFS.find((s) => s.key === settingsKey);
  const embed = baseEmbed(COLORS.info)
    .setTitle(`Setting: ${def.label}`)
    .setDescription(`Current value: ${val ? `\`${val}\`` : "Not set"}\n\n**To change via chat:**\n\`!chat set ${settingsKey} to <value>\`\n\n**To clear:**\n\`!chat unset ${settingsKey}\``)
    .setFooter({ text: def.type === "toggle" ? "Boolean toggle" : def.type === "role" ? "Role name or ID" : def.type === "channel" ? "Channel name" : "Free text" });
  const rows = [];
  if (def.type === "toggle") {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ap_toggle_${settingsKey}_${Date.now()}`).setLabel(val === "true" ? "Disable" : "Enable").setStyle(val === "true" ? ButtonStyle.Danger : ButtonStyle.Success),
    ));
  }
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ap_settings_${Date.now()}`).setLabel("⬅️ Back").setStyle(ButtonStyle.Primary),
  ));
  return { embed, rows };
}

export async function handleAdminPanelButton(interaction, { client }) {
  const parts = interaction.customId.split("_");
  const action = parts[1];
  const key = parts.length > 3 ? parts.slice(2, -1).join("_") : null;

  if (action === "home") {
    const panel = buildHomePanel(interaction.guild, client);
    return interaction.update({ embeds: [panel.embed], components: panel.rows});
  }

  if (action === "settings") {
    const panel = buildSettingsPanel(interaction.guild);
    return interaction.update({ embeds: [panel.embed], components: panel.rows});
  }

  if (action === "stats") {
    const panel = buildStatsPanel(interaction.guild, client);
    return interaction.update({ embeds: [panel.embed], components: panel.rows});
  }

  if (action === "set" && key) {
    const panel = buildInfoPanel(interaction.guild, key);
    return interaction.update({ embeds: [panel.embed], components: panel.rows});
  }

  if (action === "toggle" && key) {
    const settings = getSettings(interaction.guildId);
    const newVal = settings[key] === "true" ? "false" : "true";
    setSetting(interaction.guildId, key, newVal);
    const panel = buildInfoPanel(interaction.guild, key);
    return interaction.update({ embeds: [panel.embed], components: panel.rows});
  }

  if (action === "logout") {
    return interaction.update({ content: "👋 Panel closed.", embeds: [], components: []});
  }

  const panel = buildHomePanel(interaction.guild, client);
  return interaction.update({ embeds: [panel.embed], components: panel.rows});
}
