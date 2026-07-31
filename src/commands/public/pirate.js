import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "pirate";
export const description = "Talk like a pirate";
export const usage = "!pirate <text>";
export const category = "fun";

function pirateify(text) {
  return text
    .replace(/\byou\b/gi, "ye")
    .replace(/\byour\b/gi, "yer")
    .replace(/\byes\b/gi, "aye")
    .replace(/\bno\b/gi, "nay")
    .replace(/\bmy\b/gi, "me")
    .replace(/\bthe\b/gi, "th'")
    .replace(/\bover\b/gi, "o'er")
    .replace(/\bfriend\b/gi, "matey")
    + " Arrr!";
}

export async function execute(message, args) {
  const text = args.join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide text")] });
  }
  await message.reply({ embeds: [baseEmbed(COLORS.gold).setDescription(`> ☠️ ${pirateify(text)} ☠️`)] });
}
