import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "rate";
export const description = "Rate something out of 10";
export const usage = "!rate <thing>";
export const category = "fun";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "rate", "fun"))) return;
  const thing = args.join(" ").trim() || "this command";
  const seed = [...thing].reduce((acc, c) => acc + c.charCodeAt(0) + 5, 0);
  const score = (seed % 11);
  const stars = "★".repeat(score) + "☆".repeat(10 - score);
  const embed = baseEmbed(COLORS.gold)
    .setTitle("⭐ Rate It")
    .setDescription(`I'd rate **${thing}**\n\n**${stars}**\n\n**${score}/10**`);
  await message.reply({ embeds: [embed] });
}
