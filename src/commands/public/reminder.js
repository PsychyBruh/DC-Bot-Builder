import { baseEmbed, COLORS } from "../utils/embeds.js";
import { addReminder, getUserReminders, removeReminder } from "../../storage/reminders.js";

export const name = "reminder";
export const description = "Set a reminder (e.g. !reminder 30m drink water)";
export const usage = "!reminder <duration> <message> | !reminder list | !reminder remove <id>";
export const category = "utility";

function parseDuration(str) {
  const m = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return { ms: n * ms, label: `${n}${unit}` };
}

export async function execute(message, args) {
  const sub = args[0]?.toLowerCase();
  if (sub === "list") {
    const reminders = getUserReminders(message.author.id);
    if (reminders.length === 0) {
      return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("You have no reminders.")] });
    }
    const lines = reminders.slice(0, 10).map((r, i) => {
      const due = `<t:${Math.floor(r.remindAt / 1000)}:R>`;
      const id = r.id.split(":").pop();
      return `**${i + 1}.** (id: \`${id}\`) ${r.message.slice(0, 40)} — ${due}`;
    });
    return message.reply({ embeds: [baseEmbed(COLORS.info).setTitle("⏰ Your Reminders").setDescription(lines.join("\n"))] });
  }
  if (sub === "remove" && args[1]) {
    const target = args[1];
    const reminders = getUserReminders(message.author.id);
    const found = reminders.find((r) => r.id.endsWith(target));
    if (!found) {
      return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Reminder not found")] });
    }
    removeReminder(found.id);
    return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription("✅ Reminder removed")] });
  }
  if (!sub) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Format: `!reminder <duration> <message>`\nExample: `!reminder 30m drink water`")] });
  }
  const duration = parseDuration(sub);
  if (!duration) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Invalid duration. Examples: `30s`, `5m`, `1h`, `1d`")] });
  }
  const text = args.slice(1).join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide a message")] });
  }
  const remindAt = Date.now() + duration.ms;
  const id = addReminder(message.author.id, message.channel.id, message.guild.id, text, remindAt);
  const shortId = id.split(":").pop();
  const embed = baseEmbed(COLORS.success)
    .setTitle("⏰ Reminder Set")
    .setDescription(`**${text}**\n\nFires <t:${Math.floor(remindAt / 1000)}:R> (id: \`${shortId}\`)`)
    .setFooter({ text: `Duration: ${duration.label}` });
  await message.reply({ embeds: [embed] });
}
