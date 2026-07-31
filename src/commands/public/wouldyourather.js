import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "wouldyourather";
export const description = "Would you rather?";
export const usage = "!wouldyourather";
export const category = "fun";

const QUESTIONS = [
  ["Be able to fly", "Be able to teleport"],
  ["Live without music", "Live without movies"],
  ["Have unlimited money", "Have unlimited time"],
  ["Always be 10 minutes late", "Always be 20 minutes early"],
  ["Have a rewind button for your life", "A pause button"],
  ["Be famous but hated", "Be unknown but loved"],
  ["Lose your phone for a month", "Lose your laptop for a month"],
  ["Speak every language", "Play every instrument"],
  ["Live in the past", "Live in the future"],
  ["Have super strength", "Have super speed"],
];

export async function execute(message) {
  if (!(await applyCooldown(message, "wouldyourather", "fun"))) return;
  const [a, b] = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  const embed = baseEmbed(COLORS.purple)
    .setTitle("🤔 Would You Rather...")
    .setDescription(`>>> 🅰️ **${a}**\n\n🅱️ **${b}**\n\nReact with 🅰️ or 🅱️`);
  await message.reply({ embeds: [embed] });
}
