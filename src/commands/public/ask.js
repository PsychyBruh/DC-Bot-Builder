import { createMessage } from "../../services/ai.js";
import { readTextAttachments } from "../../services/attachments.js";
import { getSettings } from "../../storage/serverSettings.js";
import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "ask";
export const description = "Ask the AI a quick question (limited use)";
export const usage = "!ask <question> (attach .txt/.md/code files to ask about them)";
export const category = "ai";

export async function execute(message, args, { client }) {
  if (message.guild && getSettings(message.guild.id).ai_enabled === "false") {
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("🤖 AI commands are turned off in this server.")] });
  }
  if (!(await applyCooldown(message, "ask", "ai_long"))) return;
  const files = await readTextAttachments(message);
  const question = args.join(" ").trim() || (files.text ? "Summarize this file." : "");
  if (!question) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide a question: `!ask What is...`")] });
  }
  const status = await message.reply({ embeds: [baseEmbed(COLORS.info).setDescription("🤔 Thinking...")] });
  try {
    const response = await createMessage({
      max_tokens: files.text ? 1024 : 256,
      system: files.text
        ? "You are a helpful Discord bot. The user attached file(s); answer their question about them clearly and concisely. Stay under 1500 characters."
        : "You are a concise Discord bot. Answer in 1-3 sentences max. Be helpful and friendly. No emojis unless natural.",
      messages: [{ role: "user", content: files.text ? `${question}\n\n${files.text}` : question }],
    });
    const text = response.content.find((b) => b.type === "text")?.text || "(no response)";
    const embed = baseEmbed(COLORS.purple)
      .setTitle(`❓ ${question.slice(0, 80)}`)
      .setDescription(text)
      .setFooter({ text: `🤖 AI • 1 AI call${files.used.length ? ` • read ${files.used.join(", ")}` : ""}${files.skipped.length ? ` • skipped ${files.skipped.join(", ")}` : ""}` });
    await status.edit({ embeds: [embed] });
  } catch (err) {
    await status.edit({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ AI error: ${err.message}`)] });
  }
}
