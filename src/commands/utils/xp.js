import { addXp } from "../../storage/users.js";
import { baseEmbed, COLORS } from "./embeds.js";

const lastXp = new Map();

export async function handleXp(message) {
  if (message.content.length < 2) return;
  const now = Date.now();
  const last = lastXp.get(message.author.id);
  if (last && now - last < 60_000) return;
  lastXp.set(message.author.id, now);
  const xpGain = Math.min(15, 5 + Math.floor(message.content.length / 20));
  const result = addXp(message.author.id, xpGain);
  if (result.leveledUp) {
    const embed = baseEmbed(COLORS.purple)
      .setTitle("\u{1F389} Level Up!")
      .setDescription(`<@${message.author.id}> reached level **${result.level}**!\n\u{1F4B0} Level-up bonus: \u{1FA99} **${(result.levelBonus || 0).toLocaleString()}** coins`)
      .setFooter({ text: `Total XP: ${result.xp}` });
    try {
      await message.channel.send({ embeds: [embed] });
    } catch {}
  }
}
