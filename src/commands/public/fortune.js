import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "fortune";
export const description = "Random fortune cookie";
export const usage = "!fortune";
export const category = "fun";

const FORTUNES = [
  "You will find unexpected joy in an old hobby.",
  "A small adventure is coming your way this week.",
  "Your next message will bring you laughter.",
  "An old friend will reach out soon.",
  "Trust your instincts — they are sharper than you think.",
  "Soon you'll discover something you thought you knew was wrong.",
  "A dream you've been holding isn't as impossible as it seems.",
  "Take a different route tomorrow — surprise awaits.",
  "The answer you've been seeking will come in the morning.",
  "Something you've been putting off is ready to be done.",
];

export async function execute(message) {
  const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
  const embed = baseEmbed(COLORS.gold)
    .setTitle("🥠 Fortune Cookie")
    .setDescription(`>>> ${fortune}`)
    .setFooter({ text: "🥠 Crunch!" });
  await message.reply({ embeds: [embed] });
}
