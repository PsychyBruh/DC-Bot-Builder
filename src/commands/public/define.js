import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "define";
export const description = "Look up a word definition";
export const usage = "!define <word>";
export const category = "utility";

export async function execute(message, args) {
  const word = args.join(" ").trim().toLowerCase();
  if (!word) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide a word")] });
  try {
    const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!r.ok) {
      return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`❌ No definition for "${word}"`)] });
    }
    const data = await r.json();
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("❌ No definition found")] });
    const meanings = entry.meanings.slice(0, 3).map((m) => {
      const defs = m.definitions.slice(0, 2).map((d, i) => `**${i + 1}.** ${d.definition}${d.example ? `\n> *${d.example}*` : ""}`).join("\n");
      return `**${m.partOfSpeech}**\n${defs}`;
    }).join("\n\n");
    const embed = baseEmbed(COLORS.cyan)
      .setTitle(`📖 ${entry.word}`)
      .setDescription(meanings)
      .setFooter({ text: "Free Dictionary API" });
    await message.reply({ embeds: [embed] });
  } catch (err) {
    await message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Failed: ${err.message}`)] });
  }
}
