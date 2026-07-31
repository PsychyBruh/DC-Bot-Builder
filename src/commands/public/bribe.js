import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance, updateUser } from "../../storage/users.js";

export const name = "bribe";
export const description = "Pay 500c for 24h immunity from being stolen from.";
export const usage = "!bribe";
export const category = "economy";

const BRIBE_COST = 500;
const IMMUNITY_MS = 24 * 60 * 60 * 1000;

export async function execute(message) {
  if (!(await applyCooldown(message, "bribe", "economy"))) return;
  const bal = getUser(message.author.id).balance || 0;
  if (bal < BRIBE_COST) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Bribe costs ${EMOJIS.coin} **${BRIBE_COST}** (you have ${bal.toLocaleString()}).`)] });
  adjustBalance(message.author.id, -BRIBE_COST);
  updateUser(message.author.id, (u) => {
    u.stealImmune = Date.now() + IMMUNITY_MS;
    return u;
  });
  const embed = baseEmbed(COLORS.success)
    .setTitle(`${"\u{1F4B9}"} Bribe Paid`)
    .setDescription(`You're immune to \`!steal\` for the next 24 hours.`)
    .setFooter({ text: "Expires in 24h" });
  await message.reply({ embeds: [embed] });
}
