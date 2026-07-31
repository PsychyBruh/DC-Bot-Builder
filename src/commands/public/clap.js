import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "clap";
export const description = "add 👏 between words";
export const usage = "!clap <text>";
export const category = "fun";

export async function execute(message, args) {
  const text = args.join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide text")] });
  }
  const clapped = text.split(/\s+/).join(" 👏 ");
  await message.reply({ embeds: [baseEmbed(COLORS.gold).setDescription(`> 👏 ${clapped} 👏`)] });
}
