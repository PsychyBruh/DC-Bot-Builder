import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "urban";
export const description = "Urban Dictionary lookup";
export const usage = "!urban <term>";
export const category = "utility";

export async function execute(message, args) {
  const term = args.join(" ").trim();
  if (!term) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide a term")] });
  }
  try {
    const r = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
    if (!r.ok) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("❌ Urban Dictionary error")] });
    const d = await r.json();
    if (!d.list?.length) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`❌ No definition for "${term}"`)] });
    const entry = d.list[0];
    const embed = baseEmbed(COLORS.cyan)
      .setTitle(`📖 ${entry.word}`)
      .setURL(entry.permalink)
      .setDescription((entry.definition || "").slice(0, 1000) + (entry.example ? `\n\n*Example:*\n>>> ${entry.example.slice(0, 500)}` : ""))
      .setFooter({ text: `👍 ${entry.thumbs_up}  👎 ${entry.thumbs_down} • Urban Dictionary` });
    await message.reply({ embeds: [embed] });
  } catch (err) {
    await message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Failed: ${err.message}`)] });
  }
}
