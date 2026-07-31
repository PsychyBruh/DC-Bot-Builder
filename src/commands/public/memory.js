import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "memory";
export const description = "Simon-says style memory game";
export const usage = "!memory";
export const category = "games";

const PHASE_DELAY = 1200;

export async function execute(message) {
  if (!(await applyCooldown(message, "memory", "game"))) return;
  const sequence = Array.from({ length: 4 }, () => Math.floor(Math.random() * 4));
  const emojis = ["🔴", "🟢", "🔵", "🟡"];
  let revealed = "";
  const embed = baseEmbed(COLORS.primary).setTitle("🧠 Memory Game — Watch!");
  const msg = await message.reply({ embeds: [embed.setDescription("Get ready...")] });
  for (let i = 0; i < sequence.length; i++) {
    await new Promise((r) => setTimeout(r, PHASE_DELAY));
    revealed += emojis[sequence[i]] + " ";
    await msg.edit({ embeds: [embed.setDescription(`**Watch the sequence:**\n>>> ${revealed}`)] });
  }
  await new Promise((r) => setTimeout(r, PHASE_DELAY * 1.5));
  const promptEmbed = baseEmbed(COLORS.warning)
    .setTitle("🧠 Now Repeat!")
    .setDescription(`Type the sequence using emojis:\n${emojis.join(" ")}\n\nReply in this channel within 15 seconds.`);
  await msg.edit({ embeds: [promptEmbed] });
  const filter = (m) => m.author.id === message.author.id;
  const collector = message.channel.createMessageCollector({ filter, time: 15000, max: 1 });
  collector.on("collect", (m) => {
    const guess = m.content.trim();
    const correct = sequence.map((i) => emojis[i]).join(" ");
    if (guess === correct) {
      m.reply({ embeds: [baseEmbed(COLORS.success).setDescription("✅ Correct! Great memory!")] });
    } else {
      m.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Wrong! Sequence was: ${correct}`)] });
    }
    collector.stop();
  });
  collector.on("end", (collected, reason) => {
    if (reason === "time") {
      msg.edit({ embeds: [baseEmbed(COLORS.danger).setDescription(`⏰ Time's up! Sequence was: ${sequence.map((i) => emojis[i]).join(" ")}`)] });
    }
  });
}
