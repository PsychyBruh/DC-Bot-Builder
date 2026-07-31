import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "8ball";
export const description = "Magic 8-ball answers your question";
export const usage = "!8ball <question>";
export const category = "games";

const ANSWERS = [
  "It is certain.", "It is decidedly so.", "Without a doubt.", "Yes definitely.",
  "You may rely on it.", "As I see it, yes.", "Most likely.", "Outlook good.",
  "Yes.", "Signs point to yes.", "Reply hazy, try again.", "Ask again later.",
  "Better not tell you now.", "Cannot predict now.", "Concentrate and ask again.",
  "Don't count on it.", "My reply is no.", "My sources say no.",
  "Outlook not so good.", "Very doubtful.", "No.", "Absolutely not.",
  "The universe says no.", "Hmm, I wouldn't bet on it.", "Yes, in your dreams.",
  "Lol no.", "100%.", "Sources point to yes.",
];

export async function execute(message, args) {
  if (!(await applyCooldown(message, "8ball", "fun"))) return;
  const question = args.join(" ").trim();
  if (!question) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Ask a question!`)] });
  }
  const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
  const embed = baseEmbed(COLORS.purple)
    .setTitle(`🎱 ${EMOJIS.sparkle} Magic 8-Ball`)
    .addFields(
      { name: "Question", value: question, inline: false },
      { name: "Answer", value: `**${answer}**`, inline: false },
    )
    .setFooter({ text: "The 8-ball knows all" });
  await message.reply({ embeds: [embed] });
}
