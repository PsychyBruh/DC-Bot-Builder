import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { PROPERTIES, PROPERTY_MAP } from "../../storage/economy.js";
import { getUser, adjustBalance, updateUser } from "../../storage/users.js";

export const name = "buy-property";
export const description = "Buy a property for passive income. !buy-property <name>";
export const usage = "!buy-property <name>";
export const category = "economy";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "buy-property", "economy"))) return;
  const query = args.join(" ").toLowerCase().trim();
  if (!query) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!buy-property <name>\` (see \`!property\`)`)] });
  const prop = PROPERTIES.find((p) => p.id === query || p.name.toLowerCase() === query);
  if (!prop) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Unknown property. See \`!property\`.`)] });

  const u = getUser(message.author.id);
  if (u.property === prop.id) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`You already own **${prop.name}**.`)] });
  if (u.property) {
    const existing = PROPERTY_MAP[u.property];
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`You already own **${existing.name}**. Sell it first via \`!sell-property\`.`)] });
  }
  const bal = u.balance || 0;
  if (bal < prop.price) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You need ${EMOJIS.coin} **${prop.price.toLocaleString()}** (you have ${bal.toLocaleString()}).`)] });
  adjustBalance(message.author.id, -prop.price);
  updateUser(message.author.id, (d) => { d.property = prop.id; return d; });
  const embed = baseEmbed(COLORS.success)
    .setTitle(`${prop.emoji} Property Bought`)
    .setDescription(`You now own **${prop.name}**\n\nPassive income: ${EMOJIS.coin} **${prop.earnRate}/hour** (accrues over time; claim with \`!collect\`)`)
    .setFooter({ text: "Sell it back for half price: !sell-property | Accrual caps at 12h" });
  await message.reply({ embeds: [embed] });
}
