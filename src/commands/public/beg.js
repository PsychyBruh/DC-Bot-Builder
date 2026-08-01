import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { adjustBalance } from "../../storage/users.js";

export const name = "beg";
export const description = "Beg for coins. Random small payout, 60s cooldown.";
export const usage = "!beg";
export const category = "economy";

export async function execute(message) {
  if (!(await applyCooldown(message, "beg", "pity"))) return;
  const r = Math.random();
  let earned = 0;
  let line = "";
  if (r < 0.30) {
    earned = Math.floor(Math.random() * 25) + 1;
    line = `${"\u{1F64F}"} A passerby tossed you ${EMOJIS.coin} **${earned}**.`;
  } else if (r < 0.55) {
    earned = Math.floor(Math.random() * 13) + 3;
    line = `${"\u{1F622}"} You scraped up ${EMOJIS.coin} **${earned}** from the gutter.`;
  } else {
    line = `${EMOJIS.cross} Nobody gave you anything. Try \`!work\`, \`!daily\`, or \`!search\` instead.`;
  }
  if (earned) adjustBalance(message.author.id, earned);
  const embed = baseEmbed(COLORS.warning).setTitle(`${"\u{1FAE0}"} Beggar bowl`).setDescription(line).setFooter({ text: "Try !work, !daily, or !search for better income" });
  await message.reply({ embeds: [embed] });
}
