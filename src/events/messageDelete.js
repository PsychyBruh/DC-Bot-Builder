import { logMessage } from "../features/logging.js";
import { baseEmbed } from "../commands/utils/embeds.js";

export const name = "messageDelete";

export async function execute(message) {
  if (message.author?.bot) return;
  const guild = message.guild;
  if (!guild) return;
  // A deleted message can't be fetched, so uncached (partial) ones are logged without content.
  const content = message.partial ? "*(not cached — sent before the bot started)*" : message.content || "*(no content)*";
  const author = message.author ? message.author.tag : "*(unknown)*";
  const embed = baseEmbed(0xED4245)
    .setTitle("🗑️ Message Deleted")
    .setDescription(`**Author:** ${author}\n**Channel:** <#${message.channelId}>\n**Content:** ${content}`);
  await logMessage(guild, embed);
}
