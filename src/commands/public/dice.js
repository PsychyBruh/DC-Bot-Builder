import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance, updateUser } from "../../storage/users.js";
import { activeBooster } from "../../storage/economy.js";

export const name = "dice";
export const description = "Roll 2d6; sum >= 8 doubles your bet, <=6 loses.";
export const usage = "!dice <bet>";
export const category = "games";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "dice", "economy"))) return;
  const bet = parseInt(args[0], 10) || 0;
  if (bet < 1) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!dice <bet>\``)] });
  const bal = getUser(message.author.id).balance || 0;
  if (bal < bet) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Insufficient balance (${bal.toLocaleString()}).`)] });

  let luck = activeBooster(message.author.id, "luck") ? 0.1 : 0;
  let d1, d2;
  if (luck && Math.random() < luck) {
    d1 = Math.floor(Math.random() * 3) + 4;
    d2 = Math.floor(Math.random() * 3) + 4;
  } else {
    d1 = Math.floor(Math.random() * 6) + 1;
    d2 = Math.floor(Math.random() * 6) + 1;
  }
  const sum = d1 + d2;

  adjustBalance(message.author.id, -bet);

  let won = false;
  let line;
  if (sum >= 8) {
    won = true;
    adjustBalance(message.author.id, bet * 2);
    updateUser(message.author.id, (u) => { u.coinsWon = (u.coinsWon || 0) + bet; });
    line = `${EMOJIS.coin} \u{1F389} Sum **${sum}** \u2265 8 \u2014 you won **${bet.toLocaleString()}** coins!`;
  } else if (sum <= 6) {
    updateUser(message.author.id, (u) => { u.coinsLost = (u.coinsLost || 0) + bet; });
    line = `${EMOJIS.cross} Sum **${sum}** \u2264 6 \u2014 you lost **${bet.toLocaleString()}** coins.`;
  } else {
    // 7 = push / break-even
    adjustBalance(message.author.id, bet);
    line = `${EMOJIS.star} Sum **${sum}** \u2014 push! Your bet of ${bet.toLocaleString()} is refunded.`;
  }

  const embed = baseEmbed(won ? COLORS.success : COLORS.danger)
    .setTitle(`${"\u{1F3B2}"} Dice`)
    .setDescription(`\u{1F3B1} ${d1} + \u{1F3B1} ${d2} = **${sum}**\n\n${line}`)
    .setFooter({ text: `\u22658: win | \u22646: lose | =7: push` });
  await message.reply({ embeds: [embed] });
}
