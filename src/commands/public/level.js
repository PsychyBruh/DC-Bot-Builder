import { baseEmbed, COLORS } from "../utils/embeds.js";
import { getUser } from "../../storage/users.js";

export const name = "level";
export const description = "Check your level and XP";
export const usage = "!level [@user]";
export const category = "social";

export async function execute(message, args) {
  const target = message.mentions.users.first() || message.author;
  const user = getUser(target.id);
  const xp = user.xp || 0;
  const level = user.level || 0;
  const xpIntoLevel = xp % 100;
  const needed = 100;
  const pct = Math.min(100, Math.round((xpIntoLevel / needed) * 100));
  const barLen = 20;
  const filled = Math.round((pct / 100) * barLen);
  const bar = "█".repeat(filled) + "░".repeat(barLen - filled);
  const embed = baseEmbed(COLORS.purple)
    .setTitle(`⭐ ${target.username}'s Level`)
    .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: "Level", value: `${level}`, inline: true },
      { name: "XP", value: `${xp} / ${needed}`, inline: true },
      { name: "Progress", value: `\`${bar}\` ${pct}%`, inline: false },
    )
    .setFooter({ text: "Earn XP by chatting in the server" });
  await message.reply({ embeds: [embed] });
}
