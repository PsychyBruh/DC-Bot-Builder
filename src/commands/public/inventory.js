import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { ITEM_MAP, getInventory } from "../../storage/economy.js";

export const name = "inventory";
export const description = "View your items";
export const usage = "!inventory";
export const category = "economy";

export async function execute(message) {
  const inv = getInventory(message.author.id);
  const ids = Object.keys(inv);
  if (!ids.length) return message.reply({ embeds: [baseEmbed(COLORS.info).setDescription(`${EMOJIS.coin} Your inventory is empty. Use \`!shop\`.`)] });
  const lines = ids.map((id) => `${ITEM_MAP[id]?.emoji || "\u2753"} ${ITEM_MAP[id]?.name || id} x${inv[id]}`);
  const embed = baseEmbed(COLORS.cyan)
    .setTitle(`${"\u{1F392}"} Inventory \u2014 ${message.author.username}`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `Use !use <name> to activate, !sell <name> to sell for 50%` });
  await message.reply({ embeds: [embed] });
}

export const aliases = ["inv"];
