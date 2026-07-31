import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { getUserMemories, getGlobalMemories } from "../storage/memories.js";

export const name = "memory";

export async function execute(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("Only members with the **Administrator** permission can use this command.");
    return;
  }

  const userId = message.author.id;
  const userMems = getUserMemories(userId);
  const globalMems = getGlobalMemories();

  if (!userMems.length && !globalMems.length) {
    await message.reply("No memories saved yet.");
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("🧠 Memories");

  if (globalMems.length) {
    embed.addFields({
      name: `Global (${globalMems.length})`,
      value: globalMems.map((m, i) => `**${i + 1}.** ${m.text}`).join("\n") || "None",
    });
  }

  if (userMems.length) {
    embed.addFields({
      name: `Your memories (${userMems.length})`,
      value: userMems.map((m, i) => `**${i + 1}.** ${m.text}`).join("\n") || "None",
    });
  }

  await message.reply({ embeds: [embed] });
}
