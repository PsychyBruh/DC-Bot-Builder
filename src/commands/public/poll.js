import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "poll";
export const description = "Create a poll with reactions (e.g. !poll \"What's best?\" \"Cats\" \"Dogs\")";
export const usage = "!poll \"question\" \"opt1\" \"opt2\" ...";
export const category = "utility";

export async function execute(message, args) {
  const text = args.join(" ");
  if (!text) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Format: `!poll \"question\" \"opt1\" \"opt2\" ...")] });
  }
  const parts = text.match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) || [];
  if (parts.length < 3) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Need at least a question and 2 options in quotes")] });
  }
  const [question, ...options] = parts;
  if (options.length > 10) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Max 10 options")] });
  }
  const emojiMap = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  const optText = options.map((o, i) => `${emojiMap[i]} ${o}`).join("\n");
  const embed = baseEmbed(COLORS.info)
    .setTitle(`📊 ${question}`)
    .setDescription(optText)
    .setFooter({ text: `Poll by ${message.author.username}` });
  const reply = await message.channel.send({ embeds: [embed] });
  for (let i = 0; i < options.length; i++) {
    await reply.react(emojiMap[i]);
  }
}
