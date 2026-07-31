import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { giveRep, getUser } from "../../storage/users.js";

export const name = "rep";
export const description = "Give reputation to someone (1/day per giver per receiver)";
export const usage = "!rep @user [reason]";
export const category = "social";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "rep", "social"))) return;
  const target = message.mentions.users.first();
  if (!target) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Mention a user: \`!rep @user [reason]\``)] });
  }
  if (target.id === message.author.id) {
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`${EMOJIS.warn} You can't rep yourself`)] });
  }
  if (target.bot) {
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`${EMOJIS.warn} You can't rep bots`)] });
  }
  const reason = args.slice(1).join(" ").trim();
  const result = giveRep(message.author.id, target.id, reason);
  if (!result.ok && result.reason === "already_gave_rep_today") {
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`${EMOJIS.warn} You already gave rep to <@${target.id}> today. Come back tomorrow!`)] });
  }
  const newTotal = getUser(target.id).rep.total;
  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${EMOJIS.trophy} +1 Reputation!`)
    .setDescription(`**${target.username}** now has **${newTotal}** rep${reason ? `\n\n> "${reason}"` : ""}`)
    .setThumbnail(target.displayAvatarURL({ dynamic: true }));
  await message.reply({ embeds: [embed] });
}
