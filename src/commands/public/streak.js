import { baseEmbed, COLORS } from "../utils/embeds.js";
import { checkInStreak, getUser } from "../../storage/users.js";

export const name = "streak";
export const description = "Check in daily to grow your streak";
export const usage = "!streak";
export const category = "social";

export async function execute(message) {
  const result = checkInStreak(message.author.id);
  const data = getUser(message.author.id);
  if (!result.ok) {
    return message.reply({
      embeds: [baseEmbed(COLORS.warning)
        .setTitle("🔥 Streak")
        .setDescription(`You've already checked in today!\n\nCurrent streak: **${result.streak}** days`)],
    });
  }
  const embed = baseEmbed(COLORS.danger)
    .setTitle(`🔥 Streak: Day ${result.streak}!`)
    .setDescription(`Checked in! Keep the streak going.\n\nCurrent streak: **${result.streak}** days`)
    .setFooter({ text: "Check in again tomorrow" });
  await message.reply({ embeds: [embed] });
}
