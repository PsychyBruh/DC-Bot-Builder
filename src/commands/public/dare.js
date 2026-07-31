import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "dare";
export const description = "Truth or dare - dare";
export const usage = "!dare";
export const category = "fun";

const DARES = [
  "Send a heart react to the last person who messaged you.",
  "Type with your non-dominant hand for 5 minutes.",
  "Change your nickname to 'I ❤️ Bots' for 1 hour.",
  "Send a voice message singing your favorite song chorus.",
  "Post a selfie in #general.",
  "Send the 5th emoji on your keyboard.",
  "Type a paragraph without using the letter 'e'.",
  "Compliment the next person who messages you.",
  "React to your own last message with 🤡.",
  "Send a message using only emojis for 5 minutes.",
  "DM someone a random memory you have with them.",
  "Use !poll to ask the server an embarrassing question.",
];

export async function execute(message) {
  if (!(await applyCooldown(message, "dare", "fun"))) return;
  const embed = baseEmbed(COLORS.danger)
    .setTitle("😈 Dare")
    .setDescription(`>>> ${DARES[Math.floor(Math.random() * DARES.length)]}`);
  await message.reply({ embeds: [embed] });
}
