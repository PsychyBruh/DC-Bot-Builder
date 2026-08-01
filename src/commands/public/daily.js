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
  // Milestone bonuses: 7-day +500, 14-day +2000, 30-day +10000
  const MILESTONES = { 7: 500, 14: 2000, 30: 10000 };
  const milestone = MILESTONES[streak] || 0;
  const base = 100 + bonus + milestone;

  const coinBoost = activeBooster(message.author.id, "coin");
  const total = coinBoost ? base * 2 : base;
  adjustBalance(message.author.id, total);
  updateUser(message.author.id, (d) => {
    d.streak.dailyLast = today;
    return d;
  });
  const { leveledUp, level, levelBonus } = addXp(message.author.id, 30);

  const milestoneLine = milestone ? `\n\u{1F3C6} **Milestone streak ${streak} days!** +${milestone.toLocaleString()} bonus` : "";
  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${EMOJIS.gift} Daily Reward`)
    .setDescription(`Claimed ${EMOJIS.coin} **${total.toLocaleString()}** ${coinBoost ? "(2x coin boost) " : ""}today!\n\n${EMOJIS.fire} Daily Streak: **${streak}** \u2014 +${bonus} bonus${milestoneLine}`)
    .setFooter({ text: `Streak bonus caps at +500/day | Milestones: 7d=+500, 14d=+2000, 30d=+10000 | next reset tomorrow` });
  if (leveledUp) embed.addFields({ name: "\u{1F389} Level up!", value: `You reached level **${level}** and earned a ${EMOJIS.coin} **${(levelBonus || 0).toLocaleString()}** level-up bonus!` });
  await message.reply({ embeds: [embed] });
}
