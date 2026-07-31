import { checkCooldown, formatCooldown } from "../../storage/cooldowns.js";
import { errorEmbed, EMOJIS } from "./embeds.js";

export const COOLDOWNS = {
  game: 5_000,
  heavy: 10_000,
  economy: 3_000,
  social: 10_000,
  ai: 30_000,
  ai_long: 60_000,
  fun: 2_000,
  rep: 86_400_000,
};

export async function applyCooldown(message, command, tier = "fun") {
  const duration = cooldownDuration(command, tier);
  const result = checkCooldown(message.author.id, command, duration);
  if (result.onCooldown) {
    const embed = errorEmbed(`You're on cooldown. Try again in **${formatCooldown(result.remainingMs)}**.`)
      .setFooter({ text: `${EMOJIS.clock} Cooldown active` });
    await message.reply({ embeds: [embed] });
    return false;
  }
  return true;
}

function cooldownDuration(command, tier) {
  return COOLDOWNS[tier] || COOLDOWNS.fun;
}
