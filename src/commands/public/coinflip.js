import { EmbedBuilder } from "discord.js";
import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance } from "../../storage/users.js";
import { luckBonus, activeBooster } from "../../storage/economy.js";
import { parseBet, advanceGambleQuest } from "../utils/betting.js";

export const name = "coinflip";
export const description = "Flip a coin. Optional bet and side (e.g. !coinflip 100 tails)";
export const usage = "!coinflip [amount] [heads|tails]";
export const category = "games";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "coinflip", "game"))) return;
  const sideArg = args.find((a) => /^(h|heads|t|tails)$/i.test(a));
  const pick = sideArg && /^t/i.test(sideArg) ? "tails" : "heads";
  const betArg = args.find((a) => a !== sideArg);

  let bet = 0;
  if (betArg !== undefined) {
    const parsed = parseBet(betArg);
    if (parsed.error) return message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.danger).setDescription(`${EMOJIS.cross} ${parsed.error}`)] });
    bet = parsed.bet;
    const balance = getUser(message.author.id).balance || 0;
    if (bet > 0 && balance < bet) {
      return message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.danger).setDescription(`${EMOJIS.cross} You don't have enough coins. Balance: ${EMOJIS.coin} **${balance.toLocaleString()}**`)] });
    }
  }

  let resultText = "";
  let result = Math.random() < 0.5 ? "heads" : "tails";
  if (bet > 0) {
    adjustBalance(message.author.id, -bet);
    await advanceGambleQuest(message.author.id, message.channel);
    // Luck nudges the odds but the house always keeps an edge (max 49%).
    const winChance = Math.min(0.49, 0.45 + (activeBooster(message.author.id, "luck") ? 0.05 : 0) + luckBonus(message.author.id));
    const won = Math.random() < winChance;
    result = won ? pick : pick === "heads" ? "tails" : "heads";
    if (won) {
      // Gambling payouts are never boosted.
      adjustBalance(message.author.id, bet * 2);
      const winAmt = bet * 2;
      resultText = `\n${EMOJIS.coin} You won **${(winAmt - bet).toLocaleString()}** coins!`;
    } else {
      resultText = `\n${EMOJIS.cross} You lost **${bet.toLocaleString()}** coins.`;
    }
  }

  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${EMOJIS.coin} Coin Flip`)
    .setDescription(`${bet > 0 ? `You picked **${pick}**. ` : ""}It landed **${result.toUpperCase()}**!${resultText}`)
    .setFooter({ text: bet > 0 ? `Bet: ${bet.toLocaleString()}` : "Try !coinflip 100 tails to bet" });

  await message.reply({ embeds: [embed] });
}
