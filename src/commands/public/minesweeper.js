import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const games = new Map();

function buildGrid(revealed, mines, size = 5) {
  const rows = [];
  for (let r = 0; r < size; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < size; c++) {
      const idx = r * size + c;
      const cell = revealed[idx];
      const label = cell === undefined ? "❓" : cell === -1 ? "💥" : cell === 0 ? "·" : `${cell}`;
      const style = cell === undefined ? ButtonStyle.Secondary : cell === -1 ? ButtonStyle.Danger : cell === 0 ? ButtonStyle.Primary : ButtonStyle.Success;
      row.addComponents(new ButtonBuilder()
        .setCustomId(`ms_${idx}_${Date.now()}`)
        .setLabel(label)
        .setStyle(style)
        .setDisabled(cell !== undefined),
      );
    }
    rows.push(row);
  }
  return rows;
}

function neighbors(idx, size) {
  const r = Math.floor(idx / size);
  const c = idx % size;
  const ns = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) ns.push(nr * size + nc);
    }
  }
  return ns;
}

function countMines(mines, idx, size) {
  return neighbors(idx, size).filter((n) => mines.has(n)).length;
}

function reveal(revealed, mines, idx, size) {
  if (revealed[idx] !== undefined || mines.has(idx)) return;
  const count = countMines(mines, idx, size);
  revealed[idx] = count;
  if (count === 0) {
    for (const n of neighbors(idx, size)) reveal(revealed, mines, n, size);
  }
}

export const name = "minesweeper";
export const description = "5x5 minesweeper with 5 mines";
export const usage = "!minesweeper";
export const category = "games";

export async function execute(message) {
  if (!(await applyCooldown(message, "minesweeper", "heavy"))) return;
  const size = 5;
  const minesCount = 5;
  const positions = new Set();
  while (positions.size < minesCount) {
    positions.add(Math.floor(Math.random() * (size * size)));
  }
  const revealed = {};
  const game = { revealed, mines: positions, size, over: false, won: false };
  games.set(`${message.channelId}:${message.author.id}`, game);
  const embed = baseEmbed(COLORS.info)
    .setTitle("💣 Minesweeper (5x5)")
    .setDescription("Click cells to reveal. Avoid the mines!\n\nMines: **5**");
  await message.reply({ embeds: [embed], components: buildGrid(revealed, positions, size) });
}

export async function handleMinesweeperButton(interaction) {
  if (!interaction.customId.startsWith("ms_")) return false;
  const [_, idxStr] = interaction.customId.split("_");
  const idx = parseInt(idxStr, 10);
  const game = games.get(`${interaction.channelId}:${interaction.user.id}`);
  if (!game) return interaction.reply({ content: "❌ Game not found or not yours", ephemeral: true });
  if (game.over) return interaction.reply({ content: "❌ Game over", ephemeral: true });
  if (game.mines.has(idx)) {
    game.over = true;
    game.won = false;
    for (let i = 0; i < game.size * game.size; i++) game.revealed[i] = game.mines.has(i) ? -1 : game.revealed[i];
    const embed = baseEmbed(COLORS.danger)
      .setTitle("💥 BOOM!")
      .setDescription("You hit a mine. Game over.");
    games.delete(`${interaction.channelId}:${interaction.user.id}`);
    return interaction.update({ embeds: [embed], components: buildGrid(game.revealed, game.mines, game.size) });
  }
  reveal(game.revealed, game.mines, idx, game.size);
  const unrevealed = Object.keys(game.revealed).filter((k) => game.revealed[k] !== undefined && game.revealed[k] !== -1).length;
  const safe = game.size * game.size - game.mines.size;
  if (unrevealed === safe) {
    game.over = true;
    game.won = true;
    for (let i = 0; i < game.size * game.size; i++) game.revealed[i] = game.revealed[i] !== undefined ? game.revealed[i] : 0;
    const embed = baseEmbed(COLORS.success)
      .setTitle("🏆 You Won!")
      .setDescription("Cleared the board!");
    games.delete(`${interaction.channelId}:${interaction.user.id}`);
    return interaction.update({ embeds: [embed], components: buildGrid(game.revealed, game.mines, game.size) });
  }
  const embed = baseEmbed(COLORS.info)
    .setTitle("💣 Minesweeper")
    .setDescription(`Revealed: **${unrevealed}/${safe}**`);
  await interaction.update({ embeds: [embed], components: buildGrid(game.revealed, game.mines, game.size) });
  return true;
}
