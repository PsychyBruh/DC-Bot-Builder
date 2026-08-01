import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getAllUsers, getUsersByGuild } from "../../storage/users.js";
import { PROPERTY_MAP } from "../../storage/economy.js";
import { getPrice } from "../../storage/market.js";

export const name = "leaderboard";
export const description = "Server leaderboard by net worth.";
export const usage = "!leaderboard";
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
  const guild = message.guild;

  // Primary source: users seen in this guild (fresh per use, always accurate).
  let inGuild = getUsersByGuild(guild.id);

  // Fallback: include economy users currently in the guild member cache
  // (covers users recorded before guild tracking existed).
  if (inGuild.length === 0) {
    try { await guild.members.fetch(); } catch {}
    const memberIds = new Set(guild.members.cache.keys());
    inGuild = getAllUsers().filter((u) => memberIds.has(u.id));
  }

  if (inGuild.length === 0) {
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("No data for this server yet \u2014 start earning with `!work`, `!daily`, or `!search`!")] });
  }
  const ranked = await Promise.all(inGuild.map(async (u) => ({ id: u.id, nw: await netWorthFor(u) })));
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
  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${"\u{1F3C6}"} Server Leaderboard \u2014 Net Worth`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `Top 10 in ${guild.name} | Live values refreshed on every use | Net worth = wallet + shares + property resale` });
  await message.reply({ embeds: [embed] });
}
