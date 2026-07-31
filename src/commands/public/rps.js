import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "rps";
export const description = "Rock Paper Scissors";
export const usage = "!rps [@user]";
export const category = "games";

const CHOICES = ["rock", "paper", "scissors"];
const EMOJIS = { rock: "🪨", paper: "📄", scissors: "✂️" };

export async function execute(message) {
  if (!(await applyCooldown(message, "rps", "game"))) return;
  const embed = baseEmbed(COLORS.primary)
    .setTitle("✂️ Rock Paper Scissors")
    .setDescription("Choose your move!")
    .setFooter({ text: "React or click a button" });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rps_rock_${message.author.id}`).setLabel("🪨 Rock").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rps_paper_${message.author.id}`).setLabel("📄 Paper").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rps_scissors_${message.author.id}`).setLabel("✂️ Scissors").setStyle(ButtonStyle.Primary),
  );
  await message.reply({ embeds: [embed], components: [row] });
}

export async function handleRpsButton(interaction) {
  const [, choice, userId] = interaction.customId.split("_");
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: "Not your game.", ephemeral: true });
  }
  const bot = CHOICES[Math.floor(Math.random() * CHOICES.length)];
  let result = "tie";
  if (choice !== bot) {
    if ((choice === "rock" && bot === "scissors") || (choice === "paper" && bot === "rock") || (choice === "scissors" && bot === "paper")) result = "win";
    else result = "lose";
  }
  const colors = { win: COLORS.success, lose: COLORS.danger, tie: COLORS.warning };
  const titles = { win: "🎉 You Win!", lose: "😢 You Lose!", tie: "🤝 Tie!" };
  const embed = baseEmbed(colors[result])
    .setTitle(titles[result])
    .setDescription(`You: ${EMOJIS[choice]}\nBot: ${EMOJIS[bot]}`)
    .setFooter({ text: "RPS" });
  await interaction.update({ embeds: [embed], components: [] });
}
