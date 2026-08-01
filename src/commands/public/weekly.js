import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getUser, adjustBalance, updateUser, addXp } from "../../storage/users.js";
import { activeBooster } from "../../storage/economy.js";

export const name = "weekly";
export const description = "Claim your weekly bonus (500 + streak bonus)";
export const usage = "!weekly";
export const category = "economy";

export async function execute(message) {
  const week = getWeekId(new Date());
  const u = getUser(message.author.id);
  if (u.streak.weeklyLast === week) {
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`${EMOJIS.clock} Already claimed this week.`)] });
  }
  const lastWeek = getWeekId(new Date(Date.now() - 604800000));
  if (u.streak.weeklyLast === lastWeek) u.streak.weekly = (u.streak.weekly || 0) + 1;
  else u.streak.weekly = 1;
  const streak = u.streak.weekly;
  const bonus = Math.min((streak - 1) * 250, 5000);
  const base = 750 + bonus;

  const coinBoost = activeBooster(message.author.id, "coin");
  const total = coinBoost ? base * 2 : base;
  adjustBalance(message.author.id, total);
  updateUser(message.author.id, (d) => {
    d.streak.weeklyLast = week;
    return d;
  });
  const { leveledUp, level } = addXp(message.author.id, 120);

  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${EMOJIS.gift} Weekly Reward`)
    .setDescription(`Claimed ${EMOJIS.coin} **${total.toLocaleString()}** ${coinBoost ? "(2x coin boost) " : ""}this week!\n\n${EMOJIS.fire} Weekly Streak: **${streak}** \u2014 +${bonus} bonus`)
    .setFooter({ text: `Streak bonus caps at +5000/week (max 5750/week) | next reset in ${daysUntilNextWeek()} days` });
  if (leveledUp) embed.addFields({ name: "\u{1F389} Level up!", value: `You reached level **${level}**.` });
  await message.reply({ embeds: [embed] });
}

function getWeekId(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function daysUntilNextWeek() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay() || 7));
  return Math.ceil((next - now) / 86400000);
}
