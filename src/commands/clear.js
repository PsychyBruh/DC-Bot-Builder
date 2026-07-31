import { PermissionFlagsBits } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { clearAllMemory as clearContextMemory } from "../storage/serverContext.js";
import { clearAllMemory as clearPendingMemory } from "../storage/pendingActions.js";
import { clearAllMemory as clearSettingsMemory } from "../storage/serverSettings.js";
import { clearAllMemory as clearButtonMemory } from "../storage/buttonActions.js";
import { clearAllMemory as clearLogMemory } from "../services/logger.js";
import { clearAllMemory as clearMemoryMemory } from "../storage/memories.js";
import { clearAllUserData } from "../storage/users.js";
import { clearAllCooldowns } from "../storage/cooldowns.js";
import { clearAllRooms } from "../storage/privateRooms.js";
import { clearAllReminders } from "../storage/reminders.js";
import { clearAllGiveaways } from "../storage/giveaways.js";
import { clearAllQuotes } from "../storage/quotes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");

export const name = "clear";
export const category = "admin";

export async function execute(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("Only members with the **Administrator** permission can use this command.");
    return;
  }

  try {
    clearContextMemory();
    clearPendingMemory();
    clearSettingsMemory();
    clearButtonMemory();
    clearLogMemory();
    clearMemoryMemory();
    clearAllUserData();
    clearAllCooldowns();
    clearAllRooms();
    clearAllReminders();
    clearAllGiveaways();
    clearAllQuotes();

    for (const file of [
      "state.jsonl", "settings.json", "buttons.json", "memories.json",
      "users.json", "cooldowns.json", "privateRooms.json",
      "reminders.json", "giveaways.json", "quotes.json",
      "market.json", "lottery.json", "bounties.json",
    ]) {
      const p = path.join(DATA_DIR, file);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    const logsPath = path.join(__dirname, "..", "..", "logs.txt");
    if (fs.existsSync(logsPath)) fs.unlinkSync(logsPath);

    await message.reply("All bot memory wiped: contexts, conversations, pending actions, votes, settings, button actions, logs, memories, user data, cooldowns, private rooms, reminders, giveaways, and quotes.");
  } catch (err) {
    console.error("Clear error:", err);
    await message.reply("Something went wrong while clearing memory.");
  }
}
