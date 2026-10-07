import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance } from "../../storage/users.js";
import { activeBooster, luckBonus } from "../../storage/economy.js";
import { parseBet, advanceGambleQuest } from "../utils/betting.js";

export const name = "roulette";
export const description = "European roulette (0-36). !roulette <bet> <red|black|green|number>";
export const usage = "!roulette <bet> <red|black|number>";
export const category = "games";

const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK = Array.from({ length: 36 }, (_, i) => i + 1).filter((n) => !RED_SET.has(n));
const EMOJI = { 0: "\u{1F7E2} 0 (green)", red: "\u{1F534}", black: "\u{2B1B}" };

export async function execute(message, args) {
  if (!(await applyCooldown(message, "roulette", "economy"))) return;
  const parsed = parseBet(args[0]);
  const bet = parsed.bet || 0;
  const choice = (args[1] || "").toLowerCase();
  if (parsed.error) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!roulette <bet> <red|black|green|0-36>\``)] });
  const bal = getUser(message.author.id).balance || 0;
  if (bal < bet) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Insufficient balance (${bal.toLocaleString()}).`)] });

  let target;
  let payoutMult;
  if (choice === "red" || choice === "black") {
    target = { typeof: "color", value: choice };
    payoutMult = 2;
  } else if (choice === "green" || choice === "0") {
    target = { typeof: "number", value: 0 };
    payoutMult = 35;
  } else if (/^\d+$/.test(choice)) {
    const n = parseInt(choice, 10);
    if (n < 0 || n > 36) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Number must be 0-36.`)] });
    target = { typeof: "number", value: n };
    payoutMult = 35;
  } else {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Pick red, black, green, or a number 0-36.`)] });
  }

  // Luck charm, karma, and Golden Aura shift win chance
  let luck = (activeBooster(message.author.id, "luck") ? 0.05 : 0) + luckBonus(message.author.id);

  let spin;
  // Luck can land the ball on your colour, capped small so the house keeps its edge.
  if (luck > 0 && Math.random() < Math.min(0.02, luck) && target.typeof === "color") {
    const pool = target.value === "red" ? [...RED_SET] : BLACK;
    spin = pool[Math.floor(Math.random() * pool.length)];
  } else {
    spin = Math.floor(Math.random() * 37);
  }

  adjustBalance(message.author.id, -bet);
  await advanceGambleQuest(message.author.id, message.channel);

  const spinColor = spin === 0 ? "green" : RED_SET.has(spin) ? "red" : "black";
  let won = false;
  if (target.typeof === "color" && spinColor === target.value) won = true;
  if (target.typeof === "number" && spin === target.value) won = true;

  let resultLine;
  if (won) {
    const payout = bet * payoutMult;
    adjustBalance(message.author.id, payout); // never boosted
    resultLine = `${EMOJIS.coin} \u{1F389} You won **${(payout - bet).toLocaleString()}** coins (paid ${payout.toLocaleString()} on your ${bet} bet)!`;
  } else {
    resultLine = `${EMOJIS.cross} You lost **${bet.toLocaleString()}** coins.`;
  }

  const embed = baseEmbed(won ? COLORS.success : COLORS.danger)
    .setTitle(`${"\u{1F3B0}"} Roulette`)
    .setDescription(`Ball landed on **${spin} (${spinColor})** ${EMOJI[spinColor]}\n\n${resultLine}`)
    .setFooter({ text: `You bet: ${bet.toLocaleString()} on ${choice}` });
  await message.reply({ embeds: [embed] });
}
