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
  } else {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Use a custom emoji like `<:name:id>`")] });
  }
  const embed = baseEmbed(COLORS.purple)
    .setTitle(`🎭 ${name}`)
    .setImage(url);
  await message.reply({ embeds: [embed] });
}
