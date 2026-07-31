import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "mock";
export const description = "aLtErNaTiNg CaPs";
export const usage = "!mock <text>";
export const category = "fun";

export async function execute(message, args) {
  const text = args.join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide some text")] });
  }
  const mocked = [...text].map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join("");
  await message.reply({ embeds: [baseEmbed(COLORS.cyan).setDescription(`> ${mocked}`)] });
}
