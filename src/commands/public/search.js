import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance } from "../../storage/users.js";
import { addItem, ITEM_MAP } from "../../storage/economy.js";

export const name = "search";
export const description = "Search a random location for coins (and sometimes items).";
export const usage = "!search";
export const category = "economy";

const LOCATIONS = [
  { name: "the park",        emoji: "\u{1F3DE}\uFE0F" },
  { name: "a dumpster",      emoji: "\u{1F6AE}" },
  { name: "a dark alley",    emoji: "\u{1F469}\u{200D}\u{1F527}" },
  { name: "the beach",       emoji: "\u{1F3D6}\uFE0F" },
  { name: "the attic",       emoji: "\u{1F3E0}" },
  { name: "an old couch",    emoji: "\u{1F6CB}\uFE0F" },
  { name: "a fountain",      emoji: "\u{26F2}\uFE0F" },
  { name: "a parking lot",   emoji: "\u{1F697}" },
  { name: "the lost-and-found", emoji: "\u{1F4CB}" },
  { name: "a coat pocket",   emoji: "\u{1F9E5}" },
  { name: "the gutters",     emoji: "\u{1F6A8}" },
  { name: "an abandoned car", emoji: "\u{1F69B}" },
];

export async function execute(message) {
  if (!(await applyCooldown(message, "search", "pity"))) return;
  const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  const r = Math.random();

  if (r < 0.40) {
    // 40%: 20-80c
    const amt = Math.floor(Math.random() * 61) + 20;
    adjustBalance(message.author.id, amt);
    return reply(message, COLORS.success, `${loc.emoji} You searched ${loc.name} and found ${EMOJIS.coin} **${amt}**!`);
  }
  if (r < 0.65) {
    // 25%: 5-30c
    const amt = Math.floor(Math.random() * 26) + 5;
    adjustBalance(message.author.id, amt);
    return reply(message, COLORS.success, `${loc.emoji} You searched ${loc.name} and found ${EMOJIS.coin} **${amt}**.`);
  }
  if (r < 0.85) {
    // 20%: nothing
    return reply(message, COLORS.warning, `${loc.emoji} You searched ${loc.name} but came up empty.`);
  }
  if (r < 0.95) {
    // 10%: mugged — lose 10-50c (or nothing if broke)
    const u = getUser(message.author.id);
    const bal = u.balance || 0;
    if (bal < 1) return reply(message, COLORS.danger, `${loc.emoji} A mugger jumped you in ${loc.name} — luckily you had nothing to take!`);
    const loss = Math.min(bal, Math.floor(Math.random() * 41) + 10);
    adjustBalance(message.author.id, -loss);
    return reply(message, COLORS.danger, `${"\u{1F575}\uFE0F"} A mugger robbed you in ${loc.name} and took ${EMOJIS.coin} **${loss.toLocaleString()}**!`);
  }
  // 5%: small item drop
  const drops = ["bread", "coin_boost_1h"];
  const drop = drops[Math.floor(Math.random() * drops.length)];
  const item = ITEM_MAP[drop];
  addItem(message.author.id, drop, 1);
  return reply(message, COLORS.purple, `${item.emoji} While searching ${loc.name}, you found a **${item.name}**!\nUse it from your inventory with \`!use ${drop}\`.`);
}

async function reply(message, color, desc) {
  await message.reply({ embeds: [baseEmbed(color).setTitle(`${"\u{1F50D}"} Search`).setDescription(desc).setFooter({ text: "Cooldown: 1 min | Try !search again later" })] });
}
