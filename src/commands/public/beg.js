import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { adjustBalance } from "../../storage/users.js";

export const name = "beg";
export const description = "Beg for coins. Random payout, 60s cooldown.";
export const usage = "!beg";
export const category = "economy";

export async function execute(message) {
  if (!(await applyCooldown(message, "beg", "economy"))) return;
  const r = Math.random();
  let earned = 0;
  let line = "";
  if (r < 0.30) {
    earned = Math.floor(Math.random() * 50) + 1;
    line = `${"\u{1F64F}"} A kind stranger gave you ${EMOJIS.coin} **${earned}**.`;
  } else if (r < 0.55) {
    earned = Math.floor(Math.random() * 20) + 5;
    line = `${"\u{1F622}"} You scraped up ${EMOJIS.coin} **${earned}**.`;
  } else {
    line = `${EMOJIS.cross} Nobody gave you anything. Maybe try again later.`;
  }
  if (earned) adjustBalance(message.author.id, earned);
  const embed = baseEmbed(COLORS.warning).setTitle(`${"\u{1FAE0}"} Beggar bowl`).setDescription(line).setFooter({ text: "Try !work or !daily for steady income" });
  await message.reply({ embeds: [embed] });
}
