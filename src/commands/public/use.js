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
  if (item.id === "trophy") {
    const u = getUser(message.author.id);
    if (u.trophyActive) {
      return message.reply({ embeds: [baseEmbed(COLORS.gold).setTitle(`${"\u{1F3C6}"} Golden Aura already active`).setDescription(`Your Golden Aura has been radiating since **${new Date(u.trophySince).toLocaleDateString()}**. Go flex on the leaderboards.`)] });
    }
    updateUser(message.author.id, (d) => { d.trophyActive = true; d.trophySince = Date.now(); return d; });
    const embed = baseEmbed(COLORS.gold)
      .setTitle(`${"\u{2728}"} ${"\u{1F451}"} GOLDEN AURA UNLOCKED ${"\u{1F451}"} ${"\u{2728}"}`)
      .setDescription(`<@${message.author.id}> raised the **Golden Trophy** to the sky and a radiant **Golden Aura** erupts around them! The whole server glimmers with envy.${"\u{1F31F}"}\n\n${"\u{1F4B0}"} **+10%** coins on every reward, forever\n${"\u{1F340}"} **+5%** luck on all games\n${"\u{1F451}"} A golden crown on **!leaderboard** and **!gleaderboard**\n${"\u{1F3C6}"} Permanent status shown on your profile`)
      .setFooter({ text: "The aura never fades. Wear it proudly." });
    return message.reply({ embeds: [embed] });
  }
  return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`${item.emoji} **${item.name}** can't be "used" directly.`)] });
}

function fmtDur(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
  return `${Math.round(ms / 86400000)}d`;
}
