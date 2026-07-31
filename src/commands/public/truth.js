import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "truth";
export const description = "Truth or dare - truth";
export const usage = "!truth";
export const category = "fun";

const TRUTHS = [
  "What's the most embarrassing thing in your search history?",
  "Have you ever lied to a friend to avoid hanging out?",
  "What's a secret you've never told anyone?",
  "What's your biggest fear?",
  "Have you ever cheated on a test?",
  "What's the most childish thing you still do?",
  "Have you ever pretended to like a gift you hated?",
  "What's something you'd never admit to your parents?",
  "Have you ever ghosted someone?",
  "What's the worst date you've ever been on?",
  "If you had to date someone here, who would it be?",
  "What's your most controversial opinion?",
];

export async function execute(message) {
  if (!(await applyCooldown(message, "truth", "fun"))) return;
  const embed = baseEmbed(COLORS.info)
    .setTitle("🤔 Truth")
    .setDescription(`>>> ${TRUTHS[Math.floor(Math.random() * TRUTHS.length)]}`);
  await message.reply({ embeds: [embed] });
}
