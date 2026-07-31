import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "roll";
export const description = "Roll dice. Default 1d6. e.g. !roll 3d20";
export const usage = "!roll [NdN]";
export const category = "games";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "roll", "fun"))) return;
  const input = args[0] || "1d6";
  const match = input.match(/^(\d*)d(\d+)$/i);
  if (!match) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Format: \`NdN\` (e.g. \`2d20\`)`)] });
  }
  const count = Math.min(parseInt(match[1] || "1", 10), 20);
  const sides = Math.min(parseInt(match[2], 10), 1000);
  if (count < 1 || sides < 2) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Invalid range`)] });
  }
  const rolls = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    total += r;
  }
  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${EMOJIS.dice} Rolling ${count}d${sides}`)
    .setDescription(`**Rolls:** ${rolls.join(", ")}\n**Total:** ${EMOJIS.star} **${total}**`);
  await message.reply({ embeds: [embed] });
}
