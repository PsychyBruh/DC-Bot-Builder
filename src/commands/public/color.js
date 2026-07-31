import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "color";
export const description = "Preview a hex color";
export const usage = "!color <hex>";
export const category = "utility";

function parseHex(input) {
  let hex = input.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return parseInt(hex, 16);
}

export async function execute(message, args) {
  const input = args[0];
  if (!input) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide a hex color: `!color #ff9900`")] });
  }
  const num = parseHex(input);
  if (num === null) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Invalid hex. Try `!color #ff9900`")] });
  }
  const hex = `#${num.toString(16).padStart(6, "0").toUpperCase()}`;
  const embed = baseEmbed(num)
    .setTitle(`🎨 Color ${hex}`)
    .setDescription(`\`\`\`${hex.toUpperCase()}\n${num}\`\`\``)
    .addFields(
      { name: "RGB", value: `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`, inline: true },
      { name: "Decimal", value: `${num}`, inline: true },
      { name: "Hex", value: hex, inline: true },
    );
  await message.reply({ embeds: [embed] });
}
