import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "yoda";
export const description = "Talk like Yoda";
export const usage = "!yoda <text>";
export const category = "fun";

function yodaify(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  if (words.length < 4) return words.reverse().join(" ") + ", hmmm.";
  const mid = Math.floor(words.length / 2);
  return [...words.slice(mid), ...words.slice(0, mid)].join(" ") + ", hmmm.";
}

export async function execute(message, args) {
  const text = args.join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide text")] });
  }
  await message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`> 🐉 ${yodaify(text)}`)] });
}
