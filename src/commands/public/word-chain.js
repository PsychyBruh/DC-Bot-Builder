import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { WORDS } from "./wordle.js";
import { rewardCoins } from "../../storage/economy.js";

const games = new Map();
const CHAIN_GOAL = 10;
const CHAIN_REWARD = 300;
const WORD_SET = new Set(WORDS.map((w) => w.toUpperCase()));

export function stopSession(channelId, userId) {
  return games.delete(`${channelId}:${userId}`);
}

export const name = "word-chain";
export const description = `Word chain — chain ${CHAIN_GOAL} five-letter words for a reward`;
export const usage = "!word-chain";
export const category = "games";

export async function execute(message) {
  if (!(await applyCooldown(message, "word-chain", "heavy"))) return;
  const start = WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
  const game = { current: start, used: new Set([start]) };
  games.set(`${message.channelId}:${message.author.id}`, game);
  const embed = baseEmbed(COLORS.cyan)
    .setTitle("🔗 Word Chain")
    .setDescription(`Starting word: **${start}**\n\nType a **5-letter word** that starts with **${start.slice(-1)}**.\nChain **${CHAIN_GOAL}** words to win ${CHAIN_REWARD} coins.`);
  await message.reply({ embeds: [embed] });
}

export async function handleWordChainGuess(message, word) {
  const game = games.get(`${message.channelId}:${message.author.id}`);
  if (!game) return false;
  const guess = word.toUpperCase();
  if (!/^[A-Z]{5}$/.test(guess)) {
    await message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("❌ Must be exactly 5 letters.")] });
    return true;
  }
  if (game.used.has(guess)) {
    await message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("❌ Already used!")] });
    return true;
  }
  if (game.current.slice(-1) !== guess[0]) {
    await message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`❌ Must start with **${game.current.slice(-1)}**.`)] });
    return true;
  }
  if (!WORD_SET.has(guess)) {
    await message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("❌ Not in my word list.")] });
    return true;
  }
  game.used.add(guess);
  game.current = guess;
  if (game.used.size - 1 >= CHAIN_GOAL) {
    games.delete(`${message.channelId}:${message.author.id}`);
    const won = rewardCoins(message.author.id, CHAIN_REWARD);
    await message.reply({ embeds: [baseEmbed(COLORS.success).setTitle("🔗 Chain complete!").setDescription(`**${guess}** — ${CHAIN_GOAL} words chained! +${won.toLocaleString()} coins.`)] });
    return true;
  }
  const embed = baseEmbed(COLORS.cyan)
    .setTitle("🔗 Word Chain")
    .setDescription(`**${guess}**\n\nNext word starts with **${guess.slice(-1)}**.\nChain: **${game.used.size - 1}/${CHAIN_GOAL}**`);
  await message.reply({ embeds: [embed] });
  return true;
}
