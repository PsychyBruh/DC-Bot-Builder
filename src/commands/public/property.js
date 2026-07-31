import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { PROPERTIES } from "../../storage/economy.js";

export const name = "property";
export const description = "List properties for sale and their passive income.";
export const usage = "!property";
export const category = "economy";

export async function execute(message) {
  const lines = PROPERTIES.map((p) => `${p.emoji} **${p.name}** \u2014 ${EMOJIS.coin} **${p.price.toLocaleString()}**\n> _Passive income: ${EMOJIS.coin} ${p.income}/work shift_\n> _${p.desc}_`);
  const embed = baseEmbed(COLORS.cyan)
    .setTitle(`${"\u{1F3E2}"} Properties`)
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: "Use !buy-property <name> to purchase. Only one property at a time." });
  await message.reply({ embeds: [embed] });
}
