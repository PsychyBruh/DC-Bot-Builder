import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { analyzeGuild } from "../services/analyzer.js";
import { setContext } from "../storage/serverContext.js";

export const name = "analyze";

export async function execute(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("Only members with the **Administrator** permission can use this command.");
    return;
  }

  const status = await message.reply("Analyzing server...");

  try {
    const context = await analyzeGuild(message.guild);

    setContext(message.guild.id, context);

    const channelCount = context.channels.filter((c) => !c.c).length;
    const categoryCount = context.channels.filter((c) => c.c).length;

    const embed = new EmbedBuilder()
      .setTitle("Server Analysis Complete")
      .setColor(0x00ff99)
      .setDescription(`Scanned **${context.s}** successfully.`)
      .addFields(
        { name: "Categories", value: `${categoryCount}`, inline: true },
        { name: "Channels", value: `${channelCount}`, inline: true },
        { name: "Roles", value: `${context.roles.length}`, inline: true },
        { name: "Emoji", value: `${context.emojis.length}`, inline: true },
        { name: "Members", value: `${context.mc}`, inline: true },
        { name: "Boost Level", value: `Level ${context.boost}`, inline: true },
      )
      .setTimestamp();

    await status.edit({ content: null, embeds: [embed] });
  } catch (error) {
    console.error("Analyze error:", error);
    await status.edit("Failed to analyze the server. Make sure I have the necessary permissions.");
  }
}
