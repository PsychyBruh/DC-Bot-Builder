import { EmbedBuilder } from "discord.js";
import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance, updateUser } from "../../storage/users.js";

export const name = "coinflip";
export const description = "Flip a coin. Optional bet (e.g. !coinflip 100)";
export const usage = "!coinflip [amount]";
export const category = "games";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "coinflip", "game"))) return;
  const choice = Math.random() < 0.5 ? "heads" : "tails";

  let bet = 0;
  if (args[0] && /^\d+$/.test(args[0])) {
    bet = parseInt(args[0], 10);
    const balance = getUser(message.author.id).balance || 0;
    if (bet > 0 && balance < bet) {
      return message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.danger).setDescription(`${EMOJIS.cross} You don't have enough coins. Balance: ${EMOJIS.coin} **${balance.toLocaleString()}**`)] });
    }
  }

  let resultText = "";
  if (bet > 0) {
    adjustBalance(message.author.id, -bet);
    const won = Math.random() < 0.45;
    if (won) {
      adjustBalance(message.author.id, bet * 2);
      updateUser(message.author.id, (u) => { u.coinsWon = (u.coinsWon || 0) + bet; });
      resultText = `\n${EMOJIS.coin} You won **${bet.toLocaleString()}** coins!`;
    } else {
      updateUser(message.author.id, (u) => { u.coinsLost = (u.coinsLost || 0) + bet; });
      resultText = `\n${EMOJIS.cross} You lost **${bet.toLocaleString()}** coins.`;
    }
  }

  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${EMOJIS.coin} Coin Flip`)
    .setDescription(`**${choice.toUpperCase()}**!${resultText}`)
    .setFooter({ text: bet > 0 ? `Bet: ${bet.toLocaleString()}` : "Try !coinflip 100 to bet" });

  await message.reply({ embeds: [embed] });
}
