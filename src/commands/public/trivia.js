import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, updateUser } from "../../storage/users.js";

export const name = "trivia";
export const description = "Answer a trivia question";
export const usage = "!trivia";
export const category = "games";

const TRIVIA = [
  { q: "What is the capital of France?", a: ["paris"], opts: ["London", "Paris", "Berlin", "Madrid"] },
  { q: "What planet is known as the Red Planet?", a: ["mars"], opts: ["Venus", "Jupiter", "Mars", "Saturn"] },
  { q: "Who painted the Mona Lisa?", a: ["leonardo da vinci", "da vinci", "leonardo"], opts: ["Van Gogh", "Picasso", "Leonardo da Vinci", "Michelangelo"] },
  { q: "What is the largest ocean on Earth?", a: ["pacific", "pacific ocean"], opts: ["Atlantic", "Indian", "Pacific", "Arctic"] },
  { q: "How many continents are there?", a: ["7", "seven"], opts: ["5", "6", "7", "8"] },
  { q: "What gas do plants breathe in?", a: ["carbon dioxide", "co2"], opts: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Helium"] },
  { q: "Who wrote Romeo and Juliet?", a: ["shakespeare", "william shakespeare"], opts: ["Dickens", "Shakespeare", "Hemingway", "Twain"] },
  { q: "What is the smallest unit of life?", a: ["cell"], opts: ["Atom", "Cell", "Molecule", "Organ"] },
  { q: "What year did WW2 end?", a: ["1945"], opts: ["1943", "1944", "1945", "1946"] },
  { q: "What is the speed of light approximately?", a: ["299792458", "300000000", "3x10^8"], opts: ["300 km/s", "3000 km/s", "300,000 km/s", "300,000,000 m/s"] },
  { q: "Who developed the theory of relativity?", a: ["einstein", "albert einstein"], opts: ["Newton", "Einstein", "Galileo", "Tesla"] },
  { q: "What is H2O?", a: ["water"], opts: ["Salt", "Water", "Sugar", "Air"] },
  { q: "How many bones are in the adult human body?", a: ["206"], opts: ["186", "206", "226", "256"] },
  { q: "What is the largest mammal?", a: ["blue whale", "whale"], opts: ["Elephant", "Blue Whale", "Giraffe", "Hippopotamus"] },
  { q: "What language is spoken in Brazil?", a: ["portuguese"], opts: ["Spanish", "Portuguese", "English", "French"] },
];

export async function execute(message) {
  if (!(await applyCooldown(message, "trivia", "game"))) return;
  const pick = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
  const shuffled = [...pick.opts].sort(() => Math.random() - 0.5);

  const embed = baseEmbed(COLORS.gold)
    .setTitle("🧠 Trivia Question")
    .setDescription(`>>> ${pick.q}`)
    .addFields({ name: "Options", value: shuffled.map((o, i) => `**${["A","B","C","D"][i]})** ${o}`).join("\n") })
    .setFooter({ text: "You have 30 seconds. +50 coins for correct, +10 for trying" });

  const reply = await message.reply({ embeds: [embed] });

  const filter = (m) => m.author.id === message.author.id && /^[a-dA-D]$/.test(m.content.trim());
  const collector = message.channel.createMessageCollector({ filter, time: 30_000, max: 1 });

  collector.on("collect", (m) => {
    const choice = m.content.trim().toUpperCase();
    const chosen = shuffled[choice.charCodeAt(0) - 65];
    const correct = pick.a.some((ans) => chosen.toLowerCase().includes(ans));
    updateUser(message.author.id, (u) => { u.triviaAnswered = (u.triviaAnswered || 0) + 1; });
    if (correct) {
      updateUser(message.author.id, (u) => { u.triviaScore = (u.triviaScore || 0) + 1; });
      adjustBalance(message.author.id, 50);
      m.reply({ embeds: [baseEmbed(COLORS.success).setTitle("✅ Correct!").setDescription(`**${chosen}** is right! +50 coins 🪙`)] });
    } else {
      adjustBalance(message.author.id, 10);
      const correctOpt = pick.opts.find((o) => pick.a.some((a) => o.toLowerCase().includes(a)));
      m.reply({ embeds: [baseEmbed(COLORS.danger).setTitle("❌ Wrong!").setDescription(`The answer was **${correctOpt}**. +10 coins for trying 🪙`)] });
    }
  });

  collector.on("end", (_, reason) => {
    if (reason === "time") {
      reply.edit({ embeds: [embed.setFooter({ text: "⏰ Time's up!" })] });
    }
  });
}
