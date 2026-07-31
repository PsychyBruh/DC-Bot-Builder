import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "ask";
export const description = "Ask Claude a quick question (limited use)";
export const usage = "!ask <question>";
export const category = "ai";

export async function execute(message, args, { client }) {
  if (!(await applyCooldown(message, "ask", "ai_long"))) return;
  const question = args.join(" ").trim();
  if (!question) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide a question: `!ask What is...`")] });
  }
  const status = await message.reply({ embeds: [baseEmbed(COLORS.info).setDescription("🤔 Thinking...")] });
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      cache_control: { type: "ephemeral" },
      system: "You are a concise Discord bot. Answer in 1-3 sentences max. Be helpful and friendly. No emojis unless natural.",
      messages: [{ role: "user", content: question }],
    });
    const text = response.content[0].text;
    const embed = baseEmbed(COLORS.purple)
      .setTitle(`❓ ${question.slice(0, 80)}`)
      .setDescription(text)
      .setFooter({ text: "🤖 Claude • 1 AI call" });
    await status.edit({ embeds: [embed] });
  } catch (err) {
    await status.edit({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ AI error: ${err.message}`)] });
  }
}
