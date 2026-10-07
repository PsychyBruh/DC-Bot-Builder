import { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getSettings, setSetting, removeSetting } from "../../storage/serverSettings.js";
import { getAllRooms } from "../../storage/privateRooms.js";
import { getUser } from "../../storage/users.js";

export const name = "admin-panel";
export const description = "Admin panel for the bot's server settings";
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

export async function execute(message, args, { client }) {
  const panel = buildHomePanel(message.guild, client);
  await message.reply({ embeds: [panel.embed], components: panel.rows });
}

// Which settings each category button shows
const PANEL_KEYS = {
  settings: SETTINGS_DEFS.map((d) => d.key),
  roles: ["auto_role", "member_role"],
  welcome: ["welcome_channel", "welcome_message", "goodbye_channel", "goodbye_message"],
  channels: ["welcome_channel", "goodbye_channel", "log_channel"],
  ai: ["ai_enabled"],
};

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

function buildSettingsPanel(guild, panelKey = "settings") {
  const settings = getSettings(guild.id);
  const defs = SETTINGS_DEFS.filter((d) => PANEL_KEYS[panelKey].includes(d.key));
  const fields = defs.map((def) => {
    const val = settings[def.key];
    const status = val ? `✅ \`${val}\`` : "⚪ Not set";
    return { name: def.label, value: status, inline: true };
  });
  const embed = baseEmbed(COLORS.primary)
    .setTitle(`${PANELS[panelKey].emoji} ${PANELS[panelKey].name}`)
    .setDescription("Current configuration. Use the buttons below to toggle or set values.")
    .addFields(fields)
    .setFooter({ text: "Click a setting to view, toggle or clear it" });

  // Only create rows that get buttons — an empty ActionRow is rejected by Discord.
  const rows = [];
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    if (i % 5 === 0) rows.push(new ActionRowBuilder());
    const btn = new ButtonBuilder()
      .setCustomId(`ap_set_${def.key}_${Date.now()}`)
      .setLabel(def.label.length > 25 ? def.label.slice(0, 25) : def.label)
      .setStyle(def.type === "toggle" ? (settings[def.key] === "true" ? ButtonStyle.Success : ButtonStyle.Secondary) : ButtonStyle.Secondary);
    rows[rows.length - 1].addComponents(btn);
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
    .setDescription(`Current value: ${val ? `\`${val}\`` : "Not set"}\n\n**To change via chat:**\n\`!chat set ${settingsKey} to <value>\`\n\nUse **Clear** below to unset it.`)
    .setFooter({ text: def.type === "toggle" ? "Boolean toggle" : def.type === "role" ? "Role name or ID" : def.type === "channel" ? "Channel name" : "Free text" });
  const rows = [];
  const row = new ActionRowBuilder();
  if (def.type === "toggle") {
    // Unset counts as enabled (the default)
    const on = val !== "false";
    row.addComponents(new ButtonBuilder().setCustomId(`ap_toggle_${settingsKey}_${Date.now()}`).setLabel(on ? "Disable" : "Enable").setStyle(on ? ButtonStyle.Danger : ButtonStyle.Success));
  }
  if (val) row.addComponents(new ButtonBuilder().setCustomId(`ap_clear_${settingsKey}_${Date.now()}`).setLabel("Clear").setStyle(ButtonStyle.Secondary));
  row.addComponents(new ButtonBuilder().setCustomId(`ap_settings_${Date.now()}`).setLabel("⬅️ Back").setStyle(ButtonStyle.Primary));
  rows.push(row);
  return { embed, rows };
}

export async function handleAdminPanelButton(interaction, { client }) {
  // The panel message is visible to everyone, so check every click.
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "❌ Only administrators can use the admin panel.", ephemeral: true });
  }
  const parts = interaction.customId.split("_");
  const action = parts[1];
  const key = parts.length > 3 ? parts.slice(2, -1).join("_") : null;

  if (action === "home") {
    const panel = buildHomePanel(interaction.guild, client);
    return interaction.update({ embeds: [panel.embed], components: panel.rows});
  }

  if (PANEL_KEYS[action]) {
    const panel = buildSettingsPanel(interaction.guild, action);
    return interaction.update({ embeds: [panel.embed], components: panel.rows});
  }

  if (action === "clear" && key) {
    removeSetting(interaction.guildId, key);
    const panel = buildInfoPanel(interaction.guild, key);
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
    const newVal = settings[key] === "false" ? "true" : "false";
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
