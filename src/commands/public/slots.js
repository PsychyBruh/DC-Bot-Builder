import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance } from "../../storage/users.js";

export const name = "slots";
export const description = "Slot machine. Default bet 50. !slots 100";
export const usage = "!slots [bet]";
export const category = "games";

const SYMBOLS = ["🍒", "🍋", "🍉", "⭐", "💎", "7️⃣"];
const PAYOUTS = {
  "💎💎💎": 10,
  "7️⃣7️⃣7️⃣": 8,
  "⭐⭐⭐": 5,
  "🍉🍉🍉": 4,
  "🍋🍋🍋": 3,
  "🍒🍒🍒": 3,
};

export async function execute(message, args) {
  if (!(await applyCooldown(message, "slots", "economy"))) return;
  let bet = 50;
  if (args[0] && /^\d+$/.test(args[0])) bet = parseInt(args[0], 10);
  const balance = getUser(message.author.id).balance || 0;
  if (balance < bet) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't have enough coins. Balance: ${EMOJIS.coin} **${balance.toLocaleString()}**`)] });
  }
  adjustBalance(message.author.id, -bet);

  const spin = [];
  for (let i = 0; i < 3; i++) spin.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  const key = spin.join("");
  const multiplier = PAYOUTS[key] || 0;
  const winnings = bet * multiplier;
  if (winnings > 0) {
    adjustBalance(message.author.id, winnings);
    const { updateUser } = await import("../../storage/users.js");
    updateUser(message.author.id, (u) => { u.slotsWon = (u.slotsWon || 0) + 1; });
  }
  const embed = baseEmbed(winnings > 0 ? COLORS.gold : COLORS.danger)
    .setTitle(`${EMOJIS.game} Slots ${EMOJIS.game}`)
    .setDescription(`>>> **${spin.join(" | ")}**\n\n${winnings > 0 ? `${EMOJIS.trophy} **WINNER!** +${winnings.toLocaleString()} coins (${multiplier}x)` : `${EMOJIS.cross} Better luck next time`}`)
    .setFooter({ text: `Bet: ${bet.toLocaleString()} • New balance: ${(getUser(message.author.id).balance).toLocaleString()}` });
  await message.reply({ embeds: [embed] });
}
