import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const games = new Map();
const ROWS = 6;
const COLS = 7;

function boardKey(board) {
  return board.map((row) => row.join("")).join("|");
}

function buildBoard(board, disabled = false) {
  const rows = [];
  for (let c = 0; c < COLS; c++) {
    const col = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`c4_${c}_${Date.now()}`)
        .setLabel("⬇️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
    );
    rows.push(col);
  }
  const grid = new ActionRowBuilder();
  for (let r = 0; r < ROWS; r++) {
    const cells = board[r].map((cell) => (cell ? cell : "⚪"));
    const colRow = new ActionRowBuilder();
    for (let c = 0; c < COLS; c++) {
      colRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`c4c_${r}_${c}_${Date.now()}`)
          .setLabel(cells[c])
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      );
    }
    grid.addComponents(colRow);
  }
  rows.push(grid);
  return rows;
}

function checkWin(board, player) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue;
      if (c + 3 < COLS && board[r][c + 1] === player && board[r][c + 2] === player && board[r][c + 3] === player) return true;
      if (r + 3 < ROWS && board[r + 1][c] === player && board[r + 2][c] === player && board[r + 3][c] === player) return true;
      if (r + 3 < ROWS && c + 3 < COLS && board[r + 1][c + 1] === player && board[r + 2][c + 2] === player && board[r + 3][c + 3] === player) return true;
      if (r + 3 < ROWS && c - 3 >= 0 && board[r + 1][c - 1] === player && board[r + 2][c - 2] === player && board[r + 3][c - 3] === player) return true;
    }
  }
  return false;
}

export const name = "connect4";
export const description = "Connect 4 vs another user";
export const usage = "!connect4 @user";
export const category = "games";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "connect4", "heavy"))) return;
  const opponent = message.mentions.users.first();
  if (!opponent || opponent.bot || opponent.id === message.author.id) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Mention a real user")] });
  }
  const game = {
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    players: [message.author.id, opponent.id],
    turn: 0,
  };
  games.set(`${message.channelId}:${message.author.id}`, game);
  const embed = baseEmbed(COLORS.info)
    .setTitle("🔴🟡 Connect 4")
    .setDescription(`**${message.author.username}** (🔴) vs **${opponent.username}** (🟡)\n\nTurn: **${message.author.username}**\nClick a ⬇️ to drop a token.`);
  await message.reply({ content: `${opponent}`, embeds: [embed], components: buildBoard(game.board) });
}

export async function handleConnect4Button(interaction) {
  if (!interaction.customId.startsWith("c4_")) return false;
  const [, colStr] = interaction.customId.split("_");
  const col = parseInt(colStr, 10);
  const game = games.get(`${interaction.channelId}:${interaction.user.id}`);
  if (!game) return interaction.reply({ content: "❌ Game not found or not yours", ephemeral: true });
  if (!game.players.includes(interaction.user.id)) return interaction.reply({ content: "❌ Not your game", ephemeral: true });
  const playerIdx = game.players.indexOf(interaction.user.id);
  if (playerIdx !== game.turn) return interaction.reply({ content: "❌ Not your turn", ephemeral: true });
  const token = playerIdx === 0 ? "🔴" : "🟡";
  let placed = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!game.board[r][col]) { game.board[r][col] = token; placed = r; break; }
  }
  if (placed === -1) return interaction.reply({ content: "❌ Column full", ephemeral: true });
  game.turn = 1 - game.turn;
  const p1 = await interaction.client.users.fetch(game.players[0]);
  const p2 = await interaction.client.users.fetch(game.players[1]);
  const winner = checkWin(game.board, token);
  const embed = baseEmbed(winner ? COLORS.success : COLORS.info);
  const disable = (rows) => rows.map((r) => ActionRowBuilder.from(r).setComponents(r.components.map((b) => ButtonBuilder.from(b).setDisabled(true))));
  if (winner) {
    const w = playerIdx === 0 ? p1 : p2;
    embed.setTitle(`🏆 ${w.username} Wins!`).setDescription(`**${p1.username}** (🔴) vs **${p2.username}** (🟡)`);
    games.delete(`${interaction.channelId}:${interaction.user.id}`);
    return interaction.update({ embeds: [embed], components: disable(buildBoard(game.board)) });
  }
  if (game.board.every((row) => row.every((cell) => cell))) {
    embed.setTitle("🤝 Draw!").setDescription(`**${p1.username}** vs **${p2.username}** — it's a draw!`);
    games.delete(`${interaction.channelId}:${interaction.user.id}`);
    return interaction.update({ embeds: [embed], components: disable(buildBoard(game.board)) });
  }
  const next = game.turn === 0 ? p1 : p2;
  embed.setTitle("🔴🟡 Connect 4").setDescription(`**${p1.username}** (🔴) vs **${p2.username}** (🟡)\n\nTurn: **${next.username}**`);
  await interaction.update({ embeds: [embed], components: buildBoard(game.board) });
  return true;
}
