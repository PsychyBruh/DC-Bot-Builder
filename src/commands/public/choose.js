import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "choose";
export const description = "Pick from options separated by | or commas";
export const usage = "!choose a | b | c";
export const category = "games";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "choose", "fun"))) return;
  const text = args.join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Provide options separated by \`|\` or commas`)] });
  }
  const options = text.split(/[|,]/).map((o) => o.trim()).filter(Boolean);
  if (options.length < 2) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Need at least 2 options`)] });
  }
  const pick = options[Math.floor(Math.random() * options.length)];
  const embed = baseEmbed(COLORS.cyan)
    .setTitle(`${EMOJIS.arrow} I Choose...`)
    .setDescription(`>>> **${pick}**`)
    .setFooter({ text: `From ${options.length} options` });
  await message.reply({ embeds: [embed] });
}
