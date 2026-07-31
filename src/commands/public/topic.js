import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "topic";
export const description = "Random conversation starter";
export const usage = "!topic";
export const category = "fun";

const TOPICS = [
  "If you could have any superpower, what would it be?",
  "What's the best gift you've ever received?",
  "If you could travel anywhere right now, where would you go?",
  "What's your favorite memory from childhood?",
  "If you won the lottery, what's the first thing you'd buy?",
  "What's the most interesting thing you've learned this week?",
  "If you could meet any historical figure, who would it be?",
  "What's your biggest pet peeve?",
  "If you had to eat one food for the rest of your life, what would it be?",
  "What's the best advice you've ever received?",
  "If you could instantly master any skill, what would it be?",
  "What's something you've always wanted to try but haven't?",
  "What's your favorite way to relax after a long day?",
  "If you could live in any fictional universe, which would you pick?",
  "What's the weirdest dream you've ever had?",
];

export async function execute(message) {
  if (!(await applyCooldown(message, "topic", "fun"))) return;
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const embed = baseEmbed(COLORS.purple)
    .setTitle("💬 Conversation Starter")
    .setDescription(`>>> ${topic}`);
  await message.reply({ embeds: [embed] });
}
