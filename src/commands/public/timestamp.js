import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "timestamp";
export const description = "Generate a Discord timestamp (e.g. !timestamp 2026-12-25 18:00)";
export const usage = "!timestamp <YYYY-MM-DD> [HH:MM]";
export const category = "utility";

export async function execute(message, args) {
  const date = args[0];
  const time = args[1] || "12:00";
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Format: `!timestamp 2026-12-25 18:00`")] });
  }
  const dt = new Date(`${date}T${time}:00Z`);
  const unix = Math.floor(dt.getTime() / 1000);
  if (isNaN(unix)) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Invalid date")] });
  }
  const embed = baseEmbed(COLORS.info)
    .setTitle("🕐 Discord Timestamp")
    .setDescription(`Date: **${date} ${time}**\n\n> Default: <t:${unix}>\n> Short: <t:${unix}:t>\n> Long: <t:${unix}:T>\n> Relative: <t:${unix}:R>\n> Full: <t:${unix}:F>`);
  await message.reply({ embeds: [embed] });
}
