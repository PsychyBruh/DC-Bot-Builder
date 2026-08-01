import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { rewardCoins } from "../../storage/economy.js";

export const name = "lucky";
export const description = "Free daily lucky draw — no cost, 12h cooldown, up to 50k jackpot.";
export const usage = "!lucky";
export const category = "games";

const TIER = 12 * 60 * 60 * 1000; // 12h

export async function execute(message) {
  if (!(await applyCooldown(message, "lucky", "rep"))) return; // rep tier = 24h, but we override below
  // Use a custom per-user cooldown stored as 12h
  const { getUser, updateUser } = await import("../../storage/users.js");
  const u = getUser(message.author.id);
  const now = Date.now();
  if (u.lastLucky && now - u.lastLucky < TIER) {
    const wait = TIER - (now - u.lastLucky);
    const h = Math.floor(wait / 3600000);
    const m = Math.floor((wait % 3600000) / 60000);
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`${EMOJIS.clock} You already drew today. Come back in **${h}h ${m}m**.`)] });
  }

  const r = Math.random();
  let payout = 0;
  let tier = "";
  let emoji = "";
  if (r < 0.001) {
    payout = 50_000; tier = "JACKPOT"; emoji = "\u{1F451}";
  } else if (r < 0.05) {
    payout = Math.floor(Math.random() * 4000) + 1000; tier = "Big"; emoji = "\u{1F4B0}";
  } else if (r < 0.20) {
    payout = Math.floor(Math.random() * 800) + 200; tier = "Medium"; emoji = "\u{1F4B5}";
  } else if (r < 0.50) {
    payout = Math.floor(Math.random() * 150) + 50; tier = "Small"; emoji = "\u{1FA99}";
  } else {
    payout = Math.floor(Math.random() * 40) + 10; tier = "Tiny"; emoji = EMOJIS.coin;
  }
  const won = rewardCoins(message.author.id, payout);
  updateUser(message.author.id, (d) => { d.lastLucky = now; return d; });
  try { const { progressQuest } = await import("../../storage/quests.js"); const c = progressQuest(message.author.id, "lucky"); if (c) { rewardCoins(message.author.id, c.reward); await message.channel.send({ embeds: [baseEmbed(COLORS.success).setTitle(`\u{1F4DC} Quest Complete!`).setDescription(`\`lucky ${c.target}x\` done! ${EMOJIS.coin} **${c.reward.toLocaleString()}** reward credited.`)] }).catch(() => {}); } } catch {}
  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${emoji} Lucky Draw — ${tier}`)
    .setDescription(`You drew a ${tier.toLowerCase()} prize: ${EMOJIS.coin} **${won.toLocaleString()}**!`)
    .setFooter({ text: "12h cooldown | 0.1% chance for the 50k jackpot" });
  await message.reply({ embeds: [embed] });
}
