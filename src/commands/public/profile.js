import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getUser } from "../../storage/users.js";

export const name = "profile";
export const description = "View a user profile";
export const usage = "!profile [@user]";
export const category = "social";

export async function execute(message, args) {
  const target = message.mentions.users.first() || message.author;
  const member = await message.guild.members.fetch(target.id).catch(() => null);
  const data = getUser(target.id);
  const balance = data.balance || 0;
  const rep = data.rep?.total || 0;
  const streak = data.streak?.count || 0;
  const level = data.level || 0;
  const xp = data.xp || 0;
  const xpForNext = Math.pow((level + 1) / 0.1, 2);
  const xpProgress = Math.max(0, Math.min(100, Math.floor((xp / xpForNext) * 100)));
  const xpBar = "🟦".repeat(Math.floor(xpProgress / 10)) + "⬛".repeat(10 - Math.floor(xpProgress / 10));

  const fields = [
    { name: `${EMOJIS.coin} Balance`, value: `**${balance.toLocaleString()}** coins`, inline: true },
    { name: `${EMOJIS.trophy} Reputation`, value: `**${rep}**`, inline: true },
    { name: `🔥 Streak`, value: `**${streak}** days`, inline: true },
    { name: `⭐ Level`, value: `**${level}** (${xp.toLocaleString()} XP)`, inline: true },
    { name: `XP Progress`, value: `${xpBar} ${xpProgress}%`, inline: false },
  ];

  if (data.afk) {
    const since = Math.floor((Date.now() - data.afk.since) / 60000);
    fields.push({ name: `💤 AFK`, value: data.afk.reason || `(set ${since}m ago)`, inline: false });
  }

  const embed = baseEmbed(COLORS.purple)
    .setTitle(`${target.username}'s Profile`)
    .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(fields)
    .setFooter({ text: member ? `Joined: ${member.joinedAt?.toDateString() || "unknown"}` : "" });

  await message.reply({ embeds: [embed] });
}
