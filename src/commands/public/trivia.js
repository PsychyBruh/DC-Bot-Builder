import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, updateUser, adjustBalance } from "../../storage/users.js";

export const name = "trivia";
export const description = "Answer a trivia question";
export const usage = "!trivia";
export const category = "games";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TRIVIA_PATH = join(__dirname, "..", "..", "..", "data", "trivia-questions.json");

let TRIVIA = [];
try {
  const raw = readFileSync(TRIVIA_PATH, "utf8");
  TRIVIA = JSON.parse(raw);
} catch (e) {
  console.error("Failed to load trivia-questions.json:", e.message);
  TRIVIA = [
    { q: "What is the capital of France?", a: ["paris"], opts: ["London", "Paris", "Berlin", "Madrid"], cat: "general" },
    { q: "What planet is known as the Red Planet?", a: ["mars"], opts: ["Venus", "Jupiter", "Mars", "Saturn"], cat: "general" },
    { q: "Who painted the Mona Lisa?", a: ["leonardo da vinci", "da vinci", "leonardo"], opts: ["Van Gogh", "Picasso", "Leonardo da Vinci", "Michelangelo"], cat: "general" },
  ];
}

const CORRECT_REWARD = 1250;
const TRY_REWARD = 25;

export async function execute(message) {
  if (!(await applyCooldown(message, "trivia", "game"))) return;
  const pick = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
  const shuffled = [...pick.opts].sort(() => Math.random() - 0.5);

  const embed = baseEmbed(COLORS.gold)
    .setTitle("\u{1F9E0} Trivia Question")
    .setDescription(`>>> ${pick.q}`)
    .addFields({ name: "Options", value: shuffled.map((o, i) => `**${i + 1})** ${o}`).join("\n") })
    .setFooter({ text: `Category: ${pick.cat} | Reply with the option NUMBER (1-4) or the answer text. 30s. +${CORRECT_REWARD} for correct, +${TRY_REWARD} for trying` });

  const reply = await message.reply({ embeds: [embed] });

  const filter = (m) => {
    if (m.author.id !== message.author.id) return false;
    const c = m.content.trim().toLowerCase();
    if (/^[1-4]$/.test(c)) return true;
    if (/^[a-d]$/.test(c)) return true;
    if (c.length >= 2) return true;
    return false;
  };
  const collector = message.channel.createMessageCollector({ filter, time: 30_000, max: 1 });

  collector.on("collect", async (m) => {
    const raw = m.content.trim();
    const lower = raw.toLowerCase();
    let chosen = null;
    let correct = false;

    if (/^[1-4]$/.test(raw)) {
      chosen = shuffled[parseInt(raw, 10) - 1];
      correct = pick.a.some((ans) => chosen.toLowerCase().includes(ans));
    } else if (/^[a-dA-D]$/.test(raw)) {
      chosen = shuffled[raw.toUpperCase().charCodeAt(0) - 65];
      correct = pick.a.some((ans) => chosen.toLowerCase().includes(ans));
    } else {
      correct = pick.a.some((ans) => lower === ans || lower.includes(ans) || ans.includes(lower));
      if (!correct) {
        const matchedOpt = shuffled.find((o) => o.toLowerCase() === lower || o.toLowerCase().includes(lower) || lower.includes(o.toLowerCase()));
        if (matchedOpt) {
          chosen = matchedOpt;
          correct = pick.a.some((ans) => matchedOpt.toLowerCase().includes(ans));
        }
      }
    }

    updateUser(message.author.id, (u) => { u.triviaAnswered = (u.triviaAnswered || 0) + 1; });
    if (correct) {
      updateUser(message.author.id, (u) => { u.triviaScore = (u.triviaScore || 0) + 1; });
      adjustBalance(message.author.id, CORRECT_REWARD);
      try { const { progressQuest } = await import("../../storage/quests.js"); const c = progressQuest(message.author.id, "trivia"); if (c) { adjustBalance(message.author.id, c.reward); await message.channel.send({ embeds: [baseEmbed(COLORS.success).setTitle(`\u{1F4DC} Quest Complete!`).setDescription(`\`trivia ${c.target}x\` done! ${EMOJIS.coin} **${c.reward.toLocaleString()}** reward credited.`)] }).catch(() => {}); } } catch {}
      m.reply({ embeds: [baseEmbed(COLORS.success).setTitle("\u{2705} Correct!").setDescription(`Right answer! +${CORRECT_REWARD.toLocaleString()} ${EMOJIS.coin}`)] });
    } else {
      adjustBalance(message.author.id, TRY_REWARD);
      const correctOpt = shuffled.find((o) => pick.a.some((a) => o.toLowerCase().includes(a) || a.includes(o.toLowerCase()))) || pick.opts.find((o) => pick.a.some((a) => o.toLowerCase().includes(a) || a.includes(o.toLowerCase()))) || pick.a[0];
      m.reply({ embeds: [baseEmbed(COLORS.danger).setTitle("\u{274C} Wrong!").setDescription(`The answer was **${correctOpt}**. +${TRY_REWARD} ${EMOJIS.coin} for trying.`)] });
    }
  });

  collector.on("end", (_, reason) => {
    if (reason === "time") {
      reply.edit({ embeds: [embed.setFooter({ text: "\u{23F0} Time's up!" })] }).catch(() => {});
    }
  });
}
