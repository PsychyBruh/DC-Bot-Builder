import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser } from "../../storage/users.js";

export const name = "ai-roast";
export const description = "Claude roasts a user based on their recent activity";
export const usage = "!ai-roast @user";
export const category = "ai";

export async function execute(message, args, { client }) {
  if (!(await applyCooldown(message, "ai-roast", "ai_long"))) return;
  const target = message.mentions.users.first() || message.author;
  const status = await message.reply({ embeds: [baseEmbed(COLORS.info).setDescription("🔥 Cooking up a roast...")] });
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const data = getUser(target.id);
    const prompt = `Roast ${target.username}. They have ${data.balance || 0} coins, ${data.rep?.total || 0} rep, ${data.streak?.count || 0}-day streak, level ${data.level || 0}. Keep it funny, light-hearted, no slurs. Max 3 sentences.`;
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      cache_control: { type: "ephemeral" },
      system: "You are a witty Discord bot. Quick, playful roasts. No slurs, no hate.",
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].text;
    const embed = baseEmbed(COLORS.danger)
      .setTitle(`🔥 Roasting ${target.username}`)
      .setDescription(text)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "🤖 Claude" });
    await status.edit({ embeds: [embed] });
  } catch (err) {
    await status.edit({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ AI error: ${err.message}`)] });
  }
}
