import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "shakespeare";
export const description = "Talk in Shakespearean style";
export const usage = "!shakespeare <text>";
export const category = "fun";

function shakespeareify(text) {
  return text
    .replace(/\byou\b/gi, "thou")
    .replace(/\byour\b/gi, "thy")
    .replace(/\byou're\b/gi, "thou art")
    .replace(/\bare\b/gi, "be")
    .replace(/\bhello\b/gi, "hail")
    .replace(/\bgoodbye\b/gi, "fare thee well")
    .replace(/!/g, ", verily!")
    + " Hark!";
}

export async function execute(message, args) {
  const text = args.join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide text")] });
  }
  await message.reply({ embeds: [baseEmbed(COLORS.purple).setDescription(`> 🎭 ${shakespeareify(text)} 🎭`)] });
}
