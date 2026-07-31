import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "reverse";
export const description = "Reverse text";
export const usage = "!reverse <text>";
export const category = "fun";

export async function execute(message, args) {
  const text = args.join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide text")] });
  }
  const reversed = [...text].reverse().join("");
  await message.reply({ embeds: [baseEmbed(COLORS.purple).setDescription(`> ${reversed}`)] });
}
