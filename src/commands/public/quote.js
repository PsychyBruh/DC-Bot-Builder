import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getRandomQuote } from "../../storage/quotes.js";

export const name = "quote";
export const description = "Random quote (server pool)";
export const usage = "!quote";
export const category = "fun";

export async function execute(message) {
  if (!(await applyCooldown(message, "quote", "fun"))) return;
  const q = getRandomQuote();
  if (!q) {
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("No quotes yet. Use `!quote-add <quote> | <author>` to add one.")] });
  }
  const embed = baseEmbed(COLORS.purple)
    .setTitle("💬 Quote")
    .setDescription(`>>> "${q.text}"\n\n— *${q.author}*`);
  await message.reply({ embeds: [embed] });
}
