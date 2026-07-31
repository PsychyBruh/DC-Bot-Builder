import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { ITEMS, setBooster, removeItem, activeBooster } from "../../storage/economy.js";
import { updateUser, getUser, adjustBalance } from "../../storage/users.js";

export const name = "use";
export const description = "Use an item from your inventory. !use <item>";
export const usage = "!use <item>";
export const category = "economy";

export async function execute(message, args) {
  const query = args.join(" ").toLowerCase().trim();
  if (!query) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!use <item>\``)] });
  const item = ITEMS.find((i) => i.name.toLowerCase() === query || i.id === query);
  if (!item) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Unknown item.`)] });
  const u = getUser(message.author.id);
  if (!u.inventory?.[item.id]) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't own **${item.name}**.`)] });

  if (item.type === "booster") {
    removeItem(message.author.id, item.id, 1);
    setBooster(message.author.id, item.booster, item.duration);
    return message.reply({ embeds: [baseEmbed(COLORS.success).setTitle(`${item.emoji} Activated`).setDescription(`**${item.name}** active for the next ${fmtDur(item.duration)}.\n${item.desc}`)] });
  }
  if (item.type === "consumable" && item.booster) {
    // bribe_token uses no booster slot; handled by !bail
  }
  if (item.id === "bribe_token") {
    removeItem(message.author.id, item.id, 1);
    updateUser(message.author.id, (d) => { d.stealFails = 0; d.jailed = null; return d; });
    return message.reply({ embeds: [baseEmbed(COLORS.success).setTitle(`${item.emoji} Used`).setDescription(`Cleared your jail state and fail count.`)] });
  }
  return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`${item.emoji} **${item.name}** can't be "used" directly.`)] });
}

function fmtDur(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
  return `${Math.round(ms / 86400000)}d`;
}
