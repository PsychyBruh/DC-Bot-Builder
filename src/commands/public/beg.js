import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { rewardCoins } from "../../storage/economy.js";

export const name = "beg";
export const description = "Beg for coins. Random small payout, 60s cooldown.";
export const usage = "!beg";
export const category = "economy";

export async function execute(message) {
  if (!(await applyCooldown(message, "beg", "pity"))) return;
  const r = Math.random();

  // 1/1000 jackpot: wealthy benefactor drops 100k
  if (r < 0.001) {
    const won = rewardCoins(message.author.id, 100_000);
    const embed = baseEmbed(COLORS.gold)
      .setTitle(`${"\u{1F451}"} Lucky Beggar!`)
      .setDescription(`${"\u{1F4B0}"} A mysterious benefactor drops a fistful of gold into your bowl...\n\n# ${EMOJIS.coin} **${won.toLocaleString()}** coins!`)
      .setFooter({ text: "1 in 1000 chance | You hit the beggar jackpot" });
    return message.reply({ embeds: [embed] });
  }

  const roll = (r - 0.001) / 0.999; // renormalize remaining outcomes onto [0,1)
  let earned = 0;
  let line = "";
  if (roll < 0.30) {
    earned = Math.floor(Math.random() * 25) + 1;
    line = `${"\u{1F64F}"} A passerby tossed you ${EMOJIS.coin} **${earned}**.`;
  } else if (roll < 0.55) {
    earned = Math.floor(Math.random() * 13) + 3;
    line = `${"\u{1F622}"} You scraped up ${EMOJIS.coin} **${earned}** from the gutter.`;
  } else {
    line = `${EMOJIS.cross} Nobody gave you anything. Try \`!work\`, \`!daily\`, or \`!search\` instead.`;
  }
  if (earned) { const won = rewardCoins(message.author.id, earned); line = line.replace(`**${earned}**`, `**${won}**`); }
  try { const { progressQuest } = await import("../../storage/quests.js"); const c = progressQuest(message.author.id, "beg"); if (c) rewardCoins(message.author.id, c.reward); } catch {}
  const embed = baseEmbed(COLORS.warning).setTitle(`${"\u{1FAE0}"} Beggar bowl`).setDescription(line).setFooter({ text: "Try !work, !daily, or !search for better income" });
  await message.reply({ embeds: [embed] });
}
