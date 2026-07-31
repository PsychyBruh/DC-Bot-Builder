import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance, updateUser } from "../../storage/users.js";
import { isJailed, freeFromJail, hasItem, removeItem } from "../../storage/economy.js";

export const name = "bail";
export const description = "Pay 500c (or use a Bribe Token) to escape jail.";
export const usage = "!bail";
export const category = "economy";

const BAIL_COST = 500;

export async function execute(message) {
  if (!(await applyCooldown(message, "bail", "economy"))) return;
  const jo = isJailed(message.author.id);
  if (!jo) return message.reply({ embeds: [baseEmbed(COLORS.info).setDescription(`${EMOJIS.check} You're not in jail.`)] });

  const u = getUser(message.author.id);
  const bal = u.balance || 0;
  if (bal < BAIL_COST && !hasItem(message.author.id, "bribe_token")) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Bail costs ${EMOJIS.coin} **${BAIL_COST}** or a Bribe Token. You have neither.`)] });
  }
  // Prefer Bribe Token if user has one
  if (hasItem(message.author.id, "bribe_token")) {
    removeItem(message.author.id, "bribe_token", 1);
    freeFromJail(message.author.id);
    return message.reply({ embeds: [baseEmbed(COLORS.success).setTitle(`${EMOJIS.check} Freed`).setDescription("Used a Bribe Token to escape jail.")] });
  }
  adjustBalance(message.author.id, -BAIL_COST);
  freeFromJail(message.author.id);
  return message.reply({ embeds: [baseEmbed(COLORS.success).setTitle(`${EMOJIS.check} Freed`).setDescription(`Paid ${EMOJIS.coin} **${BAIL_COST}** bail and walked free.`)] });
}
