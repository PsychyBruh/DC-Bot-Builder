import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "joke";
export const description = "Random joke";
export const usage = "!joke";
export const category = "fun";

const JOKES = [
  "Why don't scientists trust atoms? Because they make up everything.",
  "Why did the scarecrow win an award? Because he was outstanding in his field.",
  "Why don't programmers like nature? Too many bugs.",
  "How does the moon cut his hair? Eclipse it.",
  "Why did the math book look so sad? Because of all of its problems.",
  "What do you call cheese that isn't yours? Nacho cheese.",
  "Why can't your nose be 12 inches long? Because then it would be a foot.",
  "What do you call a fake noodle? An impasta.",
  "Why did the golfer bring two pairs of pants? In case he got a hole in one.",
  "I'm reading a book about anti-gravity. It's impossible to put down.",
  "What did one wall say to the other? I'll meet you at the corner.",
  "Why did the chicken cross the road? To get to the other side.",
  "What do you call a bear with no teeth? A gummy bear.",
  "Why don't eggs tell jokes? They'd crack each other up.",
  "What do you call a sleeping dinosaur? A dino-snore.",
];

export async function execute(message) {
  if (!(await applyCooldown(message, "joke", "fun"))) return;
  const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
  const embed = baseEmbed(COLORS.cyan)
    .setTitle("😂 Joke")
    .setDescription(joke);
  await message.reply({ embeds: [embed] });
}
