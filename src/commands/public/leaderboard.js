import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getTopUsers } from "../../storage/users.js";

function makeLeaderboard(cmd, title, icon, color, sortKey, formatter) {
  return {
    name: cmd,
    description: title,
    usage: `!${cmd}`,
    category: "leaderboard",
    async execute(message) {
      const top = getTopUsers(sortKey, 10);
      if (top.length === 0) {
        return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("No data yet")] });
      }
      const lines = await Promise.all(top.map(async (u, i) => {
        let name = "Unknown";
        try {
          const user = await message.client.users.fetch(u.id);
          name = user.username;
        } catch {}
        const value = formatter(u);
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**${i + 1}.**`;
        return `${medal} **${name}** — ${value}`;
      }));
      const embed = baseEmbed(color)
        .setTitle(`${icon} ${title}`)
        .setDescription(lines.join("\n"))
        .setFooter({ text: "Top 10" });
      await message.reply({ embeds: [embed] });
    },
  };
}

const mod = makeLeaderboard("leaderboard", "🏆 Top by Balance", "💰", COLORS.gold, "balance", (u) => `${EMOJIS.coin} ${(u.balance || 0).toLocaleString()}`);
export const name = mod.name;
export const description = mod.description;
export const usage = mod.usage;
export const category = mod.category;
export const execute = mod.execute;
