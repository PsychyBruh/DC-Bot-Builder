import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getUser, adjustBalance, userExists } from "../../storage/users.js";

export const name = "eco";
export const description = "Exclusive economy admin: give/take coins from any user.";
export const usage = "!eco <give|take> <@user> <amount>";
export const category = "admin";
export const adminOnly = true;

export const OWNER_IDS = new Set(["812812088502255636", "601068529378132019"]);

export async function execute(message, args) {
  if (!OWNER_IDS.has(message.author.id)) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't have permission to use this command.`)] });
  }

  const action = (args[0] || "").toLowerCase();
  if (!["give", "take"].includes(action)) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!eco <give|take> <@user> <amount>\``)] });
  }

  const target = message.mentions.users.first();
  if (!target) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!eco <give|take> <@user> <amount>\``)] });
  }

  const amount = parseInt(args.find((a) => /^\d+$/.test(a)), 10) || 0;
  if (amount < 1) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Specify a positive amount.`)] });
  }

  // Ensure the target has an economy record before mutating
  getUser(target.id);

  let newBalance;
  if (action === "give") {
    newBalance = adjustBalance(target.id, amount);
  } else {
    newBalance = adjustBalance(target.id, -amount);
  }

  const verb = action === "give" ? "Gave" : "Took";
  const arrow = action === "give" ? "+" : "-";
  const color = action === "give" ? COLORS.success : COLORS.warning;

  const embed = baseEmbed(color)
    .setTitle(`${action === "give" ? "\u{1F4B0}" : "\u{1F4B5}"} ${verb} coins`)
    .setDescription(`${verb} ${EMOJIS.coin} **${amount.toLocaleString()}** ${arrow} **${target.username}**.\n\nNew balance: ${EMOJIS.coin} **${newBalance.toLocaleString()}**`);
  await message.reply({ embeds: [embed] });
}
