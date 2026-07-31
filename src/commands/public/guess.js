import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

const games = new Map();

export const name = "guess";
export const description = "Number guessing game (1-100)";
export const usage = "!guess";
export const category = "games";

export async function execute(message) {
  if (!(await applyCooldown(message, "guess", "game"))) return;
  if (games.has(message.author.id)) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ You already have an active game. Use `!guessend` to abort.")] });
  }
  const target = Math.floor(Math.random() * 100) + 1;
  games.set(message.author.id, { target, tries: 6 });
  const embed = baseEmbed(COLORS.cyan)
    .setTitle("🔢 Number Guess")
    .setDescription("I'm thinking of a number between **1** and **100**.\n\nYou have **6 tries**. Reply with your guess!")
    .setFooter({ text: "Reply with just a number" });
  await message.reply({ embeds: [embed] });
}

export function getGuessGame(userId) {
  return games.get(userId);
}

export function deleteGuessGame(userId) {
  return games.delete(userId);
}

export function stopSession(channelId, userId) {
  return games.delete(userId);
}

export async function handleGuessMessage(message) {
  if (!/^\d+$/.test(message.content)) return false;
  const game = games.get(message.author.id);
  if (!game) return false;
  const guess = parseInt(message.content, 10);
  if (guess < 1 || guess > 100) return false;
  game.tries--;
  if (guess === game.target) {
    games.delete(message.author.id);
    const triesUsed = 7 - game.tries;
    const embed = baseEmbed(COLORS.success)
      .setTitle("✅ Correct!")
      .setDescription(`**${guess}** is the number!\n\nSolved with **${triesUsed}** tries.`)
      .setFooter({ text: "Nice!" });
    await message.reply({ embeds: [embed] });
    return true;
  }
  if (game.tries === 0) {
    games.delete(message.author.id);
    const embed = baseEmbed(COLORS.danger)
      .setTitle("❌ Out of Tries")
      .setDescription(`The number was **${game.target}**.`);
    await message.reply({ embeds: [embed] });
    return true;
  }
  const hint = guess < game.target ? "📈 Higher" : "📉 Lower";
  const embed = baseEmbed(COLORS.info)
    .setTitle(`🔢 ${hint}`)
    .setDescription(`Your guess: **${guess}**\n\nTries left: **${game.tries}**`);
  await message.reply({ embeds: [embed] });
  return true;
}
