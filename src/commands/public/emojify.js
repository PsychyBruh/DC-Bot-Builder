import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "emojify";
export const description = "Replace letters with emoji letters";
export const usage = "!emojify <text>";
export const category = "fun";

const EMOJI_LETTERS = {
  a: "🅰️", b: "🅱️", c: "🇨", d: "🇩", e: "🇪", f: "🇫", g: "🇬",
  h: "🇭", i: "🇮", j: "🇯", k: "🇰", l: "🇱", m: "🇲", n: "🇳",
  o: "🅾️", p: "🇵", q: "🇶", r: "🇷", s: "🇸", t: "🇹", u: "🇺",
  v: "🇻", w: "🇼", x: "🇽", y: "🇾", z: "🇿",
};

export async function execute(message, args) {
  const text = args.join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide text")] });
  }
  const result = text.toLowerCase().split("").map((c) => {
    if (c === " ") return "  ";
    if (/[0-9]/.test(c)) return `⃣`;
    return EMOJI_LETTERS[c] || c;
  }).join("");
  await message.reply({ embeds: [baseEmbed(COLORS.cyan).setDescription(`> ${result}`)] });
}
