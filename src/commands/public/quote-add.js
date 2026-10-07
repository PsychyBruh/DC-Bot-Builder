import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { addQuote } from "../../storage/quotes.js";

export const name = "quote-add";
export const description = "Add a quote to the server pool (e.g. !quote-add Life is beautiful | Anonymous)";
export const usage = "!quote-add <text> | <author>";
export const category = "fun";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "quote-add", "social"))) return;
  const text = args.join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Format: `!quote-add <quote> | <author>`")] });
  }
  let quoteText = text;
  let author = "Anonymous";
  const sep = text.indexOf("|");
  if (sep > -1) {
    quoteText = text.slice(0, sep).trim();
    author = text.slice(sep + 1).trim() || "Anonymous";
  }
  if (!quoteText) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ The quote can't be empty.")] });
  if (quoteText.length > 300 || author.length > 60) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Quotes are limited to 300 characters and authors to 60.")] });
  addQuote(quoteText, author);
  const embed = baseEmbed(COLORS.success)
    .setTitle("✅ Quote Added")
    .setDescription(`>>> "${quoteText}"\n\n— *${author}*`);
  await message.reply({ embeds: [embed] });
}
