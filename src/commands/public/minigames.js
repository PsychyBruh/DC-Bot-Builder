import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser } from "../../storage/users.js";
import { rewardCoins } from "../../storage/economy.js";

export const name = "minigames";
export const description = "Quick free mini-game vs the bot for coins. !minigames <rps|coinflip|hilo>";
export const usage = "!minigames <rps|coinflip|hilo>";
export const category = "games";

const PAYOUT = { rps: 100, coinflip: 80, hilo: 150 };
const EMO = { rock: "\u{1FAA8}", paper: "\u{1F4C4}", scissors: "\u{2702}\uFE0F", heads: "\u{1FA74}\uFE0F", tails: "\u{1F9E8}" };

export async function execute(message, args) {
  if (!(await applyCooldown(message, "minigames", "game"))) return;
  const sub = (args[0] || "").toLowerCase();
  const bal = getUser(message.author.id).balance || 0;
  const isPlay = ["rps", "coinflip", "hilo"].includes(sub);
  if (isPlay) try { const { progressQuest } = await import("../../storage/quests.js"); const c = progressQuest(message.author.id, "minigames"); if (c) { rewardCoins(message.author.id, c.reward); await message.channel.send({ embeds: [baseEmbed(COLORS.success).setTitle(`\u{1F4DC} Quest Complete!`).setDescription(`\`minigames ${c.target}x\` done! ${EMOJIS.coin} **${c.reward.toLocaleString()}** reward credited.`)] }).catch(() => {}); } } catch {}

  if (sub === "rps") {
    const pick = (args[1] || "").toLowerCase();
    if (!["rock", "paper", "scissors"].includes(pick)) {
      return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!minigames rps <rock|paper|scissors>\` | Win = ${PAYOUT.rps}c`)] });
    }
    const botChoice = ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)];
    let result, payout;
    if (pick === botChoice) { result = "Draw"; payout = 10; }
    else if (
      (pick === "rock" && botChoice === "scissors") ||
      (pick === "paper" && botChoice === "rock") ||
      (pick === "scissors" && botChoice === "paper")
    ) { result = "Win"; payout = PAYOUT.rps; }
    else { result = "Lose"; payout = 0; }
    const wonAmt = payout ? rewardCoins(message.author.id, payout) : 0;
    return message.reply({ embeds: [baseEmbed(result === "Win" ? COLORS.success : result === "Draw" ? COLORS.warning : COLORS.danger)
      .setTitle(`${EMO[pick]} vs ${EMO[botChoice]} \u2014 ${result}`)
      .setDescription(`You: ${EMO[pick]} | Bot: ${EMO[botChoice]}${wonAmt ? `\n+${EMOJIS.coin} **${wonAmt.toLocaleString()}**${wonAmt !== payout ? ` (2x boost, base ${payout})` : ""}` : ""}`)] });
  }

  if (sub === "coinflip") {
    const pick = (args[1] || "").toLowerCase();
    if (!["heads", "tails"].includes(pick)) {
      return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!minigames coinflip <heads|tails>\` | Win = ${PAYOUT.coinflip}c`)] });
    }
    const flip = Math.random() < 0.5 ? "heads" : "tails";
    const won = pick === flip;
    const payout = won ? PAYOUT.coinflip : 0;
    const wonAmt = payout ? rewardCoins(message.author.id, payout) : 0;
    return message.reply({ embeds: [baseEmbed(won ? COLORS.success : COLORS.danger)
      .setTitle(`${EMO[flip]} ${won ? "You win!" : "You lose"}`)
      .setDescription(`It landed on **${flip}**.${wonAmt ? `\n+${EMOJIS.coin} **${wonAmt.toLocaleString()}**${wonAmt !== payout ? ` (2x boost, base ${payout})` : ""}` : ""}`)] });
  }

  if (sub === "hilo") {
    // Hi-lo: bot rolls 1-100. Player guesses if next will be higher/lower. Re-roll and compare.
    const pick = (args[1] || "").toLowerCase();
    if (!["higher", "lower"].includes(pick)) {
      return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!minigames hilo <higher|lower>\` | Win = ${PAYOUT.hilo}c`)] });
    }
    const first = Math.floor(Math.random() * 100) + 1;
    const second = Math.floor(Math.random() * 100) + 1;
    let won;
    if (first === second) won = false;
    else if (pick === "higher") won = second > first;
    else won = second < first;
    const payout = won ? PAYOUT.hilo : 0;
    const wonAmt = payout ? rewardCoins(message.author.id, payout) : 0;
    return message.reply({ embeds: [baseEmbed(won ? COLORS.success : COLORS.danger)
      .setTitle(`First: ${first} \u2192 Second: ${second}`)
      .setDescription(`You guessed **${pick}**. ${won ? "Correct!" : "Wrong!"}${wonAmt ? `\n+${EMOJIS.coin} **${wonAmt.toLocaleString()}**${wonAmt !== payout ? ` (2x boost, base ${payout})` : ""}` : ""}`)] });
  }

  // No sub: show menu
  await message.reply({ embeds: [baseEmbed(COLORS.info)
    .setTitle(`\u{1F3AE} Minigames`)
    .setDescription(`Quick free games vs the bot for coins (no bet needed):\n\n\u{2702}\uFE0F \`!minigames rps <rock|paper|scissors>\` \u2014 ${EMOJIS.coin} ${PAYOUT.rps} on win\n\u{1FA74}\uFE0F \`!minigames coinflip <heads|tails>\` \u2014 ${EMOJIS.coin} ${PAYOUT.coinflip} on win\n\u{1F3B2} \`!minigames hilo <higher|lower>\` \u2014 ${EMOJIS.coin} ${PAYOUT.hilo} on win\n\nDraws pay 10c, losses pay 0.`)] });
}
