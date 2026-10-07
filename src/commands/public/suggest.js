import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { postSuggestion, similarSuggestions, suggestionChannel } from "../../features/voting.js";

export const name = "suggest";
export const description = "Post a suggestion for the community to vote on";
export const usage = "!suggest <your idea>";
export const category = "utility";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "suggest", "ai"))) return;
  const text = args.join(" ").trim();
  if (text.length < 10) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Describe your idea in at least 10 characters: `!suggest add a night map`")] });
  const similar = similarSuggestions(message.guild.id, text);
  const res = await postSuggestion(message.guild, message.author, text);
  if (res.error) return message.reply(`❌ ${res.error}`);
  const ch = suggestionChannel(message.guild);
  let note = `✅ Suggestion #${res.number} posted in ${ch}.`;
  if (similar.length) note += `\n\n🔎 Similar existing suggestions:\n${similar.map(({ id, s }) => `• [#${s.number}](https://discord.com/channels/${message.guild.id}/${ch.id}/${id}) — ${s.text.slice(0, 80)}`).join("\n")}`;
  return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(note)], allowedMentions: { parse: [] } });
}
