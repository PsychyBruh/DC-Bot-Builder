import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "neverhaveiever";
export const description = "Never have I ever";
export const usage = "!neverhaveiever";
export const category = "fun";

const QUESTIONS = [
  "Never have I ever ghosted someone.",
  "Never have I ever lied about my age.",
  "Never have I ever stalked an ex on social media.",
  "Never have I ever faked being sick to skip work/school.",
  "Never have I ever cried at a movie.",
  "Never have I ever pretended to like someone's cooking.",
  "Never have I ever cheated on a test.",
  "Never have I ever been caught singing in the shower.",
  "Never have I ever sent a text to the wrong person.",
  "Never have I ever peeked at someone else's phone.",
];

export async function execute(message) {
  if (!(await applyCooldown(message, "neverhaveiever", "fun"))) return;
  const embed = baseEmbed(COLORS.danger)
    .setTitle("🚫 Never Have I Ever")
    .setDescription(`>>> ${QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]}\n\nReact with 🙋 if you HAVE done it`);
  await message.reply({ embeds: [embed] });
}
