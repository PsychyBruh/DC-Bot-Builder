import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "vaporwave";
export const description = "ｖａｐｏｒｗａｖｅ ｔｅｘｔ";
export const usage = "!vaporwave <text>";
export const category = "fun";

function toFullwidth(s) {
  let out = "";
  for (const c of s) {
    const code = c.charCodeAt(0);
    if (code >= 33 && code <= 126) out += String.fromCharCode(code + 65248);
    else if (code === 32) out += "　";
    else out += c;
  }
  return out;
}

export async function execute(message, args) {
  const text = args.join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide text")] });
  }
  await message.reply({ embeds: [baseEmbed(COLORS.purple).setDescription(`> ${toFullwidth(text)}`)] });
}
