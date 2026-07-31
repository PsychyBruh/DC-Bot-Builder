import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "leet";
export const description = "1337 speak";
export const usage = "!leet <text>";
export const category = "fun";

const LEET_MAP = {
  a: "4", b: "8", e: "3", g: "9", i: "1", l: "1", o: "0",
  s: "5", t: "7", z: "2",
};

export async function execute(message, args) {
  const text = args.join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide text")] });
  }
  const result = [...text.toLowerCase()].map((c) => LEET_MAP[c] || c).join("");
  await message.reply({ embeds: [baseEmbed(COLORS.cyan).setDescription(`> ${result}`)] });
}
