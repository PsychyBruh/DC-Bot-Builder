import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance } from "../../storage/users.js";
import { rewardCoins, luckBonus } from "../../storage/economy.js";

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
  try { const { progressQuest } = await import("../../storage/quests.js"); const c = progressQuest(message.author.id, "gamble"); if (c) { adjustBalance(message.author.id, c.reward); await message.channel.send({ embeds: [baseEmbed(COLORS.success).setTitle(`\u{1F4DC} Quest Complete!`).setDescription(`\`gamble ${c.target}x\` done! ${EMOJIS.coin} **${c.reward.toLocaleString()}** reward credited.`)] }).catch(() => {}); } } catch {}

  const spin = [];
  for (let i = 0; i < 3; i++) spin.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  let key = spin.join("");
  let multiplier = PAYOUTS[key] || 0;
  let lucky = false;
  // Karma / Golden Aura luck: chance to re-spin and keep the better result
  if (Math.random() < luckBonus(message.author.id)) {
    const reroll = [SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]];
    const mult2 = PAYOUTS[reroll.join("")] || 0;
    if (mult2 > multiplier) { spin.length = 0; spin.push(...reroll); key = reroll.join(""); multiplier = mult2; lucky = true; }
  }
  const winnings = bet * multiplier;
  if (winnings > 0) {
    rewardCoins(message.author.id, winnings);
    const { updateUser } = await import("../../storage/users.js");
    updateUser(message.author.id, (u) => { u.slotsWon = (u.slotsWon || 0) + 1; });
  }
  const embed = baseEmbed(winnings > 0 ? COLORS.gold : COLORS.danger)
    .setTitle(`${EMOJIS.game} Slots ${EMOJIS.game}`)
    .setDescription(`>>> **${spin.join(" | ")}**\n\n${winnings > 0 ? `${EMOJIS.trophy} **WINNER!** +${winnings.toLocaleString()} coins (${multiplier}x)${lucky ? ` ${"\u{1F340}"} lucky re-spin!` : ""}` : `${EMOJIS.cross} Better luck next time`}`)
    .setFooter({ text: `Bet: ${bet.toLocaleString()} • New balance: ${(getUser(message.author.id).balance).toLocaleString()}` });
  await message.reply({ embeds: [embed] });
}
