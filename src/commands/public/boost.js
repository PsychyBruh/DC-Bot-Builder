import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getUser } from "../../storage/users.js";
import { activeBooster } from "../../storage/economy.js";

export const name = "boost";
export const description = "View your active boosters and immunity timers.";
export const usage = "!boost";
export const category = "economy";

const TYPES = [
  { key: "coin",   label: "Coin Boost (2x)",   emoji: "\u{1F4B0}" },
  { key: "xp",     label: "XP Boost (2x)",     emoji: "\u{1F4C8}" },
  { key: "luck",   label: "Luck Charm",        emoji: "\u{1F340}" },
  { key: "shield", label: "Shield (anti-steal)", emoji: "\u{1F6E1}\uFE0F" },
];

export async function execute(message) {
  const u = getUser(message.author.id);
  const lines = [];
  for (const t of TYPES) {
    const until = activeBooster(message.author.id, t.key);
    lines.push(`${t.emoji} **${t.label}**: ${until ? `active \u2014 ends in ${fmt(until - Date.now())}` : "not active"}`);
  }
  const immunityUntil = u.stealImmune || 0;
  lines.push(`${"\u{1F4B9}"} **Bribe immunity**: ${immunityUntil > Date.now() ? `ends in ${fmt(immunityUntil - Date.now())}` : "expired"}`);
  const embed = baseEmbed(COLORS.cyan)
    .setTitle(`${"\u{1F53D}"} Active Boosters \u2014 ${message.author.username}`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: "Buy more from !shop" });
  await message.reply({ embeds: [embed] });
}

function fmt(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
  return `${Math.round(ms / 86400000)}d`;
}
