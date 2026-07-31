import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance } from "../../storage/users.js";

export const name = "duel";
export const description = "Coin duel vs another user. !duel @user <wager>";
export const usage = "!duel @user <amount>";
export const category = "games";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "duel", "game"))) return;
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Mention an opponent`)] });
  if (target.id === message.author.id) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You can't duel yourself`)] });
  if (target.bot) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You can't duel a bot`)] });
  const wager = parseInt(args.find((a) => /^\d+$/.test(a)), 10) || 0;
  if (wager < 1) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Specify a wager: \`!duel @user 100\``)] });
  const bal1 = getUser(message.author.id).balance || 0;
  const bal2 = getUser(target.id).balance || 0;
  if (bal1 < wager) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't have ${wager} coins (balance: ${bal1.toLocaleString()})`)] });
  if (bal2 < wager) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} ${target.username} doesn't have ${wager} coins`)] });

  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${EMOJIS.cross}⚔️ Duel Challenge`)
    .setDescription(`**${message.author.username}** challenges **${target.username}** for **${wager.toLocaleString()}** coins!\n\n${target.username}, type \`yes\` within 30s to accept.`);
  const reply = await message.channel.send({ embeds: [embed] });
  const filter = (m) => m.author.id === target.id && ["yes", "accept", "y", "yep"].includes(m.content.toLowerCase());
  const collector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });
  collector.on("collect", async (m) => {
    const winner = Math.random() < 0.5 ? message.author : target;
    const loser = winner.id === message.author.id ? target : message.author;
    adjustBalance(winner.id, wager);
    adjustBalance(loser.id, -wager);
    const { updateUser } = await import("../../storage/users.js");
    updateUser(winner.id, (u) => { u.duelsWon = (u.duelsWon || 0) + 1; });
    updateUser(loser.id, (u) => { u.duelsLost = (u.duelsLost || 0) + 1; });
    const result = baseEmbed(COLORS.gold)
      .setTitle(`${EMOJIS.trophy} Duel Result`)
      .setDescription(`**${winner.username}** wins **${(wager * 2).toLocaleString()}** coins!`)
      .setFooter({ text: `Loser: ${loser.username}` });
    await message.channel.send({ embeds: [result] });
  });
  collector.on("end", (_, reason) => {
    if (reason === "time") {
      reply.edit({ embeds: [baseEmbed(COLORS.warning).setDescription("⏰ Challenge expired.")] });
    }
  });
}
