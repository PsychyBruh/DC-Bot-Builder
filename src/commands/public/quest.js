import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getQuests } from "../../storage/quests.js";
import { adjustBalance } from "../../storage/users.js";

export const name = "quest";
export const description = "View your 3 daily quests. Auto-pays rewards on completion.";
export const usage = "!quest";
export const category = "economy";

const ICON = {
  work: "\u{1F4BC}",
  search: "\u{1F50D}",
  fish: "\u{1F3A3}",
  beg: "\u{1FAE0}",
  gamble: "\u{1F3B0}",
  trivia: "\u{1F9E0}",
  minigames: "\u{1F3AE}",
  lucky: "\u{1F451}",
  collect: "\u{1F3E0}",
};

export async function execute(message) {
  const quests = getQuests(message.author.id);
  let totalPaidToday = 0;
  const lines = quests.map((q, i) => {
    const done = q.current >= q.target;
    const tick = done ? `${EMOJIS.check}` : `${q.current}/${q.target}`;
    return `${ICON[q.type] || EMOJIS.star} **${i + 1}.** \`${q.type}\` ${q.current}/${q.target} \u2014 ${EMOJIS.coin} ${q.reward.toLocaleString()} ${done ? "(completed)" : ""}`;
  });
  const completed = quests.filter((q) => q.current >= q.target).length;
  const embed = baseEmbed(COLORS.purple)
    .setTitle(`\u{1F4DC} Daily Quests`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `${completed}/3 completed | Rewards auto-credit on completion | New quests each day` });
  await message.reply({ embeds: [embed] });
}
