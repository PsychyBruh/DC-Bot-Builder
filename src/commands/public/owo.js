import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "owo";
export const description = "Owoify text";
export const usage = "!owo <text>";
export const category = "fun";

function owoify(text) {
  return text
    .replace(/r|l/g, "w")
    .replace(/R|L/g, "W")
    .replace(/!+/g, "!!")
    .replace(/\?+/g, "??")
    + (Math.random() < 0.5 ? " uwu" : " owo");
}

export async function execute(message, args) {
  const text = args.join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide text")] });
  }
  await message.reply({ embeds: [baseEmbed(COLORS.pink).setDescription(`> ${owoify(text)}`)] });
}
