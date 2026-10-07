import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "bigemoji";
export const description = "Big version of an emoji";
export const usage = "!bigemoji :emoji: or !bigemoji <:name:id>";
export const category = "utility";

export async function execute(message, args) {
  const input = args[0];
  if (!input) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide an emoji: `!bigemoji 😎` or `!bigemoji <:name:id>`")] });
  }
  const match = input.match(/<a?:(\w+):(\d+)>/);
  let url, name;
  if (match) {
    name = match[1];
    const ext = input.startsWith("<a:") ? "gif" : "png";
    url = `https://cdn.discordapp.com/emojis/${match[2]}.${ext}?size=512`;
  } else if (/\p{Extended_Pictographic}/u.test(input)) {
    // Standard emoji → Twemoji image (codepoints joined by '-', variation selector dropped)
    const cps = [...input.trim()].map((c) => c.codePointAt(0).toString(16)).filter((cp) => cp !== "fe0f");
    name = input.trim();
    url = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/${cps.join("-")}.png`;
  } else {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Use an emoji like 😎 or a custom one like `<:name:id>`")] });
  }
  const embed = baseEmbed(COLORS.purple)
    .setTitle(`🎭 ${name}`)
    .setImage(url);
  await message.reply({ embeds: [embed] });
}
