import { PermissionFlagsBits } from "discord.js";
import { getLogs, getAllLogsFromFile } from "../services/logger.js";

export const name = "logs";

export async function execute(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("Only members with the **Administrator** permission can use this command.");
    return;
  }

  const guildId = message.guild.id;
  const limit = args[0] ? Math.min(parseInt(args[0]) || 20, 50) : 20;

  const logs = getLogs(guildId, limit);

  if (logs.length === 0) {
    await message.reply("No actions logged yet. Run `!chat` to perform actions.");
    return;
  }

  const lines = logs.map((entry, i) => {
    const time = new Date(entry.timestamp).toLocaleString();
    const status = entry.success ? "OK" : "FAIL";
    return `**#${entry.id}** [${status}] ${time} — **${entry.userName}** — \`${entry.action}\`\n> ${entry.result?.message || "—"}`;
  });

  const header = `**Action Logs (last ${logs.length} of this session):**\n`;
  const chunks = splitMessage(header + lines.join("\n"));

  for (const chunk of chunks) {
    await message.channel.send(chunk);
  }
}

function splitMessage(text, maxLen = 1900) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (current.length + line.length + 1 > maxLen) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
