import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export const COLORS = {
  primary: 0x5865F2,
  success: 0x57F287,
  danger: 0xED4245,
  warning: 0xFEE75C,
  info: 0x5865F2,
  gold: 0xF1C40F,
  purple: 0x9B59B6,
  pink: 0xEB459E,
  cyan: 0x1ABC9C,
  dark: 0x2C2F33,
};

export const EMOJIS = {
  coin: "🪙",
  dice: "🎲",
  heart: "❤️",
  star: "⭐",
  fire: "🔥",
  trophy: "🏆",
  sparkle: "✨",
  rocket: "🚀",
  crown: "👑",
  gem: "💎",
  game: "🎮",
  money: "💰",
  robot: "🤖",
  gift: "🎁",
  chart: "📊",
  chartUp: "📈",
  pin: "📌",
  clock: "⏰",
  warn: "⚠️",
  check: "✅",
  cross: "❌",
  arrow: "➡️",
  back: "⬅️",
  refresh: "🔄",
};

export function baseEmbed(color = COLORS.primary) {
  return new EmbedBuilder().setColor(color).setTimestamp();
}

export function errorEmbed(message) {
  return new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle(`${EMOJIS.cross} Error`)
    .setDescription(message)
    .setTimestamp();
}

export function successEmbed(message) {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`${EMOJIS.check} Success`)
    .setDescription(message)
    .setTimestamp();
}

export function infoEmbed(title, description, color = COLORS.info) {
  const e = new EmbedBuilder().setColor(color).setTimestamp();
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  return e;
}

export function coins(amount) {
  return `${EMOJIS.coin} **${amount.toLocaleString()}**`;
}

export function fieldEmbed(embed, name, value, inline = true) {
  return embed.addFields({ name, value, inline });
}

export function navRow(currentPage, totalPages, baseId = "page") {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${baseId}_first`)
      .setLabel("⏮ First")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(`${baseId}_prev`)
      .setLabel(`${EMOJIS.back} Prev`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(`${baseId}_next`)
      .setLabel(`Next ${EMOJIS.arrow}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(`${baseId}_last`)
      .setLabel("Last ⏭")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1),
  );
}

export function confirmRow(yesId, noId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(yesId).setLabel("Confirm").setStyle(ButtonStyle.Success).setEmoji(EMOJIS.check),
    new ButtonBuilder().setCustomId(noId).setLabel("Cancel").setStyle(ButtonStyle.Danger).setEmoji(EMOJIS.cross),
  );
}
