import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const games = new Map();
const ROWS = 6;
const COLS = 7;
const EMPTY = "⚪";

function renderBoard(board) {
  const header = "`1  2  3  4  5  6  7`";
  const lines = board.map((row) => `\`${row.map((c) => c || EMPTY).join(" ")}\``);
  return [header, ...lines].join("\n");
}

function buildControls(disabled = false) {
  const btns = [];
  for (let c = 0; c < COLS; c++) {
    btns.push(new ButtonBuilder()
      .setCustomId(`c4d_${c}_${Date.now()}`)
      .setLabel("⬇️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled));
  }
  const row1 = new ActionRowBuilder().addComponents(btns.slice(0, 4));
  const row2 = new ActionRowBuilder().addComponents(btns.slice(4, 7));
  return [row1, row2];
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
  games.set(`${message.channelId}`, game);
  const embed = baseEmbed(COLORS.info)
    .setTitle("🔴🟡 Connect 4")
    .setDescription(`${renderBoard(game.board)}\n\n**${message.author.username}** (🔴) vs **${opponent.username}** (🟡)\n\nTurn: **${message.author.username}**`)
    .setFooter({ text: "Click a column button to drop your token" });
  await message.reply({ content: `${opponent}`, embeds: [embed], components: buildControls() });
}

export async function handleConnect4Button(interaction) {
  if (!interaction.customId.startsWith("c4d_")) return false;
  const [, colStr] = interaction.customId.split("_");
  const col = parseInt(colStr, 10);
  const game = games.get(`${interaction.channelId}`);
  if (!game) return interaction.reply({ content: "❌ No active game in this channel", ephemeral: true });
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
  const over = winner || game.board.every((row) => row.every((cell) => cell));
  if (over) {
    games.delete(`${interaction.channelId}`);
    if (winner) {
      const w = playerIdx === 0 ? p1 : p2;
      embed.setTitle(`🏆 ${w.username} Wins!`).setDescription(`${renderBoard(game.board)}\n\n**${p1.username}** (🔴) vs **${p2.username}** (🟡)`);
    } else {
      embed.setTitle("🤝 Draw!").setDescription(`${renderBoard(game.board)}\n\n**${p1.username}** vs **${p2.username}** — it's a draw!`);
    }
    return interaction.update({ embeds: [embed], components: buildControls(true) });
  }
  const next = game.turn === 0 ? p1 : p2;
  embed.setTitle("🔴🟡 Connect 4").setDescription(`${renderBoard(game.board)}\n\n**${p1.username}** (🔴) vs **${p2.username}** (🟡)\n\nTurn: **${next.username}**`);
  await interaction.update({ embeds: [embed], components: buildControls() });
  return true;
}
