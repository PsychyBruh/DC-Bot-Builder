import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getAllUsers } from "../../storage/users.js";
import { PROPERTY_MAP } from "../../storage/economy.js";
import { getPrice } from "../../storage/market.js";

export const name = "gleaderboard";
export const description = "Global leaderboard by net worth (all bot users).";
export const usage = "!gleaderboard";
export const category = "leaderboard";

async function netWorthFor(user) {
  const price = await getPrice();
  const balance = user.balance || 0;
  const shareValue = Math.floor((user.shares || 0) * price);
  const prop = user.property ? PROPERTY_MAP[user.property] : null;
  const propValue = prop ? Math.floor(prop.price * 0.5) : 0;
  return balance + shareValue + propValue;
}

export async function execute(message) {
  const all = getAllUsers();
  if (all.length === 0) {
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("No data yet")] });
  }
  const ranked = await Promise.all(all.map(async (u) => ({ id: u.id, nw: await netWorthFor(u) })));
  ranked.sort((a, b) => b.nw - a.nw);
  const top = ranked.slice(0, 10);

  const lines = await Promise.all(top.map(async (u, i) => {
    let name = "Unknown";
    try {
      const user = await message.client.users.fetch(u.id);
      name = user.username;
    } catch {}
    const medal = i === 0 ? "\u{1F947}" : i === 1 ? "\u{1F948}" : i === 2 ? "\u{1F949}" : `**${i + 1}.**`;
    return `${medal} **${name}** \u2014 ${EMOJIS.coin} **${u.nw.toLocaleString()}**`;
  }));
  const embed = baseEmbed(COLORS.purple)
    .setTitle(`${"\u{1F30D}"} Global Leaderboard \u2014 Net Worth`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: "Top 10 across all servers | Net worth = wallet + shares + property resale" });
  await message.reply({ embeds: [embed] });
}
