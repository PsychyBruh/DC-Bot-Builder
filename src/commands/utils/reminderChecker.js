import { getDueReminders, removeReminder } from "../../storage/reminders.js";
import { infoEmbed, EMOJIS, COLORS } from "./embeds.js";

let interval = null;
let running = false; // skip a tick if the previous one is still sending

export function startReminderChecker(client) {
  if (interval) return;
  interval = setInterval(async () => {
    if (running) return;
    running = true;
    try {
    const due = getDueReminders();
    for (const reminder of due) {
      try {
        const user = await client.users.fetch(reminder.userId).catch(() => null);
        if (!user) {
          removeReminder(reminder.id);
          continue;
        }
        const embed = infoEmbed(
          `${EMOJIS.clock} Reminder`,
          `You asked me to remind you:\n\n>>> ${reminder.message}${reminder.guildId ? `\n\nSet in <#${reminder.channelId}>` : ""}`,
          COLORS.gold,
        );
        await user.send({ embeds: [embed] }).catch(async () => {
          const channel = await client.channels.fetch(reminder.channelId).catch(() => null);
          if (channel) await channel.send({ content: `${user}, your reminder:`, embeds: [embed] }).catch(() => {});
        });
        removeReminder(reminder.id);
      } catch (err) {
        console.error("Reminder error:", err.message);
        removeReminder(reminder.id);
      }
    }
    } finally {
      running = false;
    }
  }, 30_000);
}
