import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getUser, adjustBalance } from "../../storage/users.js";

const games = new Map();
const DECK = [];
for (const suit of ["♠️", "♥️", "♦️", "♣️"]) {
  for (let i = 1; i <= 13; i++) DECK.push({ value: Math.min(i, 10), label: i === 1 ? "A" : i === 11 ? "J" : i === 12 ? "Q" : i === 13 ? "K" : i, suit });
}
function shuffle(d) { return [...d].sort(() => Math.random() - 0.5); }
function handVal(hand) {
  let sum = 0, aces = 0;
  for (const c of hand) { if (c.value === 1) aces++; else sum += c.value; }
  for (let i = 0; i < aces; i++) sum += sum + 11 <= 21 ? 11 : 1;
  return sum;
}
function cardStr(c) { return `${c.label}${c.suit}`; }

export const name = "blackjack";
export const description = "Blackjack against the house. Bet coins!";
export const usage = "!blackjack [bet]";
export const category = "games";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "blackjack", "economy"))) return;
  const bet = parseInt(args[0], 10) || 100;
  const user = getUser(message.author.id);
  const bal = user.balance || 0;
  if (bal < bet) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Not enough coins. You have ${bal}.`)] });
  const game = { deck: shuffle(DECK), player: [], dealer: [], bet, done: false };
  game.player.push(game.deck.pop(), game.deck.pop());
  game.dealer.push(game.deck.pop(), game.deck.pop());
  games.set(`${message.channelId}:${message.author.id}`, game);
  const embed = baseEmbed(COLORS.gold)
    .setTitle("🃏 Blackjack")
    .setDescription(`**Your hand:** ${game.player.map(cardStr).join(" ")} = **${handVal(game.player)}**\n**Dealer shows:** ${cardStr(game.dealer[0])} ?\n\nBet: ${bet} coins`);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj_hit_${message.author.id}`).setLabel("🃏 Hit").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bj_stand_${message.author.id}`).setLabel("🛑 Stand").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`bj_double_${message.author.id}`).setLabel("2️⃣ Double").setStyle(ButtonStyle.Success),
  );
  await message.reply({ embeds: [embed], components: [row] });
}

async function endGame(interaction, game) {
  if (game.done) return;
  game.done = true;
  while (handVal(game.dealer) < 17) game.dealer.push(game.deck.pop());
  const p = handVal(game.player), d = handVal(game.dealer);
  let outcome = "push";
  if (p > 21) outcome = "bust";
  else if (d > 21 || p > d) outcome = "win";
  else if (d > p) outcome = "lose";
  let coins = 0;
  if (outcome === "win") coins = game.bet;
  else if (outcome === "bust" || outcome === "lose") coins = -game.bet;
  adjustBalance(interaction.user.id, coins);
  const color = outcome === "win" ? COLORS.success : outcome === "lose" || outcome === "bust" ? COLORS.danger : COLORS.warning;
  const titles = { win: "🎉 You win!", lose: "😢 You lose!", bust: "💥 Bust!", push: "🤝 Push!" };
  const embed = baseEmbed(color)
    .setTitle(titles[outcome])
    .setDescription(`**Your hand:** ${game.player.map(cardStr).join(" ")} = **${p}**\n**Dealer:** ${game.dealer.map(cardStr).join(" ")} = **${d}**\n\n${coins >= 0 ? `+${coins}` : coins} coins`);
  await interaction.update({ embeds: [embed], components: [] });
  games.delete(`${interaction.channelId}:${interaction.user.id}`);
}

export async function handleBlackjackButton(interaction) {
  if (!interaction.customId.startsWith("bj_")) return false;
  const [, action, userId] = interaction.customId.split("_");
  if (interaction.user.id !== userId) return interaction.reply({ content: "Not your game.", ephemeral: true });
  const game = games.get(`${interaction.channelId}:${interaction.user.id}`);
  if (!game || game.done) return interaction.reply({ content: "❌ Game over.", ephemeral: true });
  if (action === "hit") {
    game.player.push(game.deck.pop());
    const p = handVal(game.player);
    if (p >= 21) return endGame(interaction, game);
    const embed = baseEmbed(COLORS.gold)
      .setTitle("🃏 Blackjack")
      .setDescription(`**Your hand:** ${game.player.map(cardStr).join(" ")} = **${p}**\n**Dealer shows:** ${cardStr(game.dealer[0])} ?`);
    return interaction.update({ embeds: [embed], components: interaction.message.components });
  }
  if (action === "double") {
    game.bet *= 2;
    game.player.push(game.deck.pop());
    return endGame(interaction, game);
  }
  if (action === "stand") return endGame(interaction, game);
  return false;
}
