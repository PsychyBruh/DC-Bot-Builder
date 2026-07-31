import { PermissionFlagsBits } from "discord.js";
import { getLastAction, removeLastAction, logAction } from "../services/logger.js";
import { undoAction } from "../services/executor.js";
import { analyzeGuild } from "../services/analyzer.js";
import { setContext, getConversation, setConversation } from "../storage/serverContext.js";

export const name = "undo";
export const category = "admin";

export async function execute(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("Only members with the **Administrator** permission can use this command.");
    return;
  }

  const guildId = message.guild.id;
  const userId = message.author.id;
  const lastAction = getLastAction(guildId);

  if (!lastAction) {
    await message.reply("No actions to undo.");
    return;
  }

  const status = await message.reply(`Undoing last action: \`${lastAction.action}\`...`);

  try {
    const result = await undoAction(message.guild, lastAction);
    const updatedContext = await analyzeGuild(message.guild);
    setContext(guildId, updatedContext);

    logAction(
      guildId,
      message.author.id,
      message.author.username,
      "undo",
      { targetAction: lastAction.action, targetLogId: lastAction.id },
      null,
      result
    );

    removeLastAction(guildId);

    const history = getConversation(guildId, userId);
    history.push({
      role: "user",
      content: `[SYSTEM: The previous action "${lastAction.action}" was undone by ${message.author.username}. ${result.success ? "Undo succeeded: " + result.message : "Undo failed: " + result.message}]`,
    });
    setConversation(guildId, userId, history);

    const msg = result.success
      ? `Undo successful: ${result.message}`
      : `Undo failed: ${result.message}`;

    await status.edit(msg);
  } catch (error) {
    console.error("Undo error:", error);
    await status.edit("An error occurred while trying to undo the last action.");
  }
}
