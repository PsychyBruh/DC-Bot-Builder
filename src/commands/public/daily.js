import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getUser, adjustBalance, updateUser, addXp } from "../../storage/users.js";
import { activeBooster } from "../../storage/economy.js";

export const name = "daily";
export const description = "Claim your daily coin reward (streaks boost payout)";
export const usage = "!daily";
export const category = "economy";

export async function execute(message) {
  const today = new Date().toISOString().slice(0, 10);
  const u = getUser(message.author.id);
  if (u.streak.dailyLast === today) {
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`${EMOJIS.clock} Already claimed today. Come back tomorrow.`)] });
  }
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (u.streak.dailyLast === yesterday) u.streak.daily = (u.streak.daily || 0) + 1;
  else u.streak.daily = 1;
  const streak = u.streak.daily;
  const bonus = Math.min((streak - 1) * 25, 500);
  const base = 50 + bonus;

  const coinBoost = activeBooster(message.author.id, "coin");
  const total = coinBoost ? base * 2 : base;
  adjustBalance(message.author.id, total);
  updateUser(message.author.id, (d) => {
    d.streak.dailyLast = today;
    return d;
  });
  const { leveledUp, level } = addXp(message.author.id, 30);

  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${EMOJIS.gift} Daily Reward`)
    .setDescription(`Claimed ${EMOJIS.coin} **${total.toLocaleString()}** ${coinBoost ? "(2x coin boost) " : ""}today!\n\n${EMOJIS.fire} Daily Streak: **${streak}** \u2014 +${bonus} bonus`)
    .setFooter({ text: `Streak bonus caps at +500/day | next reset tomorrow` });
  if (leveledUp) embed.addFields({ name: "\u{1F389} Level up!", value: `You reached level **${level}**.` });
  await message.reply({ embeds: [embed] });
}
