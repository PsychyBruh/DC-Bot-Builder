import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance } from "../../storage/users.js";
import { activeBooster, luckBonus } from "../../storage/economy.js";
import { parseBet, advanceGambleQuest } from "../utils/betting.js";

export const name = "dice";
export const description = "Roll 2d6; sum >= 8 doubles your bet, 7 refunds half, <=6 loses.";
export const usage = "!dice <bet>";
export const category = "games";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "dice", "economy"))) return;
  const parsed = parseBet(args[0]);
  if (parsed.error) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} ${parsed.error} Usage: \`!dice <bet>\``)] });
  const bet = parsed.bet;
  const bal = getUser(message.author.id).balance || 0;
  if (bal < bet) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Insufficient balance (${bal.toLocaleString()}).`)] });

  let luck = (activeBooster(message.author.id, "luck") ? 0.1 : 0) + luckBonus(message.author.id);
  let d1, d2;
  if (luck > 0 && Math.random() < Math.min(0.08, luck)) {
    d1 = Math.floor(Math.random() * 3) + 4;
    d2 = Math.floor(Math.random() * 3) + 4;
  } else {
    d1 = Math.floor(Math.random() * 6) + 1;
    d2 = Math.floor(Math.random() * 6) + 1;
  }
  const sum = d1 + d2;

  adjustBalance(message.author.id, -bet);
  await advanceGambleQuest(message.author.id, message.channel);

  let won = false;
  let line;
  if (sum >= 8) {
    won = true;
    // Gambling payouts are never boosted.
    adjustBalance(message.author.id, bet * 2);
    const winAmt = bet * 2;
    line = `${EMOJIS.coin} \u{1F389} Sum **${sum}** \u2265 8 \u2014 you won **${(winAmt - bet).toLocaleString()}** coins!`;
  } else if (sum <= 6) {
    line = `${EMOJIS.cross} Sum **${sum}** \u2264 6 \u2014 you lost **${bet.toLocaleString()}** coins.`;
  } else {
    // 7 refunds half, so the house keeps a small edge even with luck.
    const refund = Math.floor(bet / 2);
    adjustBalance(message.author.id, refund);
    line = `${EMOJIS.star} Sum **${sum}** \u2014 half your bet (${refund.toLocaleString()}) is refunded.`;
  }

  const embed = baseEmbed(won ? COLORS.success : COLORS.danger)
    .setTitle(`${"\u{1F3B2}"} Dice`)
    .setDescription(`\u{1F3B1} ${d1} + \u{1F3B1} ${d2} = **${sum}**\n\n${line}`)
    .setFooter({ text: `\u22658: win | \u22646: lose | =7: half back` });
  await message.reply({ embeds: [embed] });
}
