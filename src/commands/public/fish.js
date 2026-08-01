import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance, updateUser } from "../../storage/users.js";

export const name = "fish";
export const description = "Cast your line and reel in a random fish. 30s cooldown, up to 2k+ legendaries.";
export const usage = "!fish";
export const category = "economy";

// Tier: probability, value range, name, emoji
const FISH = [
  { p: 0.45, name: "Old Boot",       emoji: "\u{1F462}",  min: 5,   max: 30,    color: COLORS.warning },
  { p: 0.30, name: "Common Carp",    emoji: "\u{1F41F}",  min: 30,  max: 120,   color: COLORS.info },
  { p: 0.15, name: "Silver Trout",   emoji: "\u{1F3A3}",  min: 100, max: 350,   color: COLORS.cyan },
  { p: 0.08, name: "Golden Salmon",  emoji: "\u{1F419}",  min: 300, max: 800,   color: COLORS.gold },
  { p: 0.019,name: "Crystal Marlin", emoji: "\u{1F42C}",  min: 1000,max: 2000,  color: COLORS.purple },
  { p: 0.001,name: "The Kraken's Catch", emoji: "\u{1F419}", min: 3000, max: 5000, color: COLORS.gold, legendary: true },
];

const FISH_CD = 30 * 1000;

export async function execute(message) {
  if (!(await applyCooldown(message, "fish", "pity"))) return;
  const r = Math.random();
  let acc = 0;
  let fish = FISH[0];
  for (const f of FISH) {
    acc += f.p;
    if (r < acc) { fish = f; break; }
  }
  const baseValue = Math.floor(Math.random() * (fish.max - fish.min + 1)) + fish.min;
  const isFisherman = getUser(message.author.id).job === "fisher";
  const value = isFisherman ? baseValue * 4 : baseValue;
  adjustBalance(message.author.id, value);
  updateUser(message.author.id, (d) => {
    d.fishCaught = (d.fishCaught || 0) + 1;
    if (!d.fishBest || value > d.fishBest.value) d.fishBest = { name: fish.name, value };
    return d;
  });
  try { const { progressQuest } = await import("../../storage/quests.js"); const c = progressQuest(message.author.id, "fish"); if (c) { adjustBalance(message.author.id, c.reward); await message.channel.send({ embeds: [baseEmbed(COLORS.success).setTitle(`\u{1F4DC} Quest Complete!`).setDescription(`\`fish ${c.target}x\` done! ${EMOJIS.coin} **${c.reward.toLocaleString()}** reward credited.`)] }).catch(() => {}); } } catch {}

  const embed = baseEmbed(fish.color)
    .setTitle(`${fish.emoji} You caught a ${fish.name}!`)
    .setDescription(`Reeled in a **${fish.name}** and sold it for ${EMOJIS.coin} **${value.toLocaleString()}**.${isFisherman ? `\n${"\u{1F3A3}"} **Fisherman 4x bonus!** (base ${baseValue.toLocaleString()})` : ""}`)
    .setFooter({ text: fish.legendary ? "LEGENDARY \u2014 1 in a thousand casts!" : `Cooldown: 30s | Total caught: ${(getUser(message.author.id).fishCaught || 0)}` });
  await message.reply({ embeds: [embed] });
}
