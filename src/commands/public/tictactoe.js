import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const games = new Map();

function buildBoard(board) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const cell = board[idx] || "·";
      row.addComponents(new ButtonBuilder()
        .setCustomId(`ttt_${idx}_${Date.now()}`)
        .setLabel(cell)
        .setStyle(cell === "·" ? ButtonStyle.Secondary : cell === "❌" ? ButtonStyle.Danger : ButtonStyle.Primary)
        .setDisabled(cell !== "·"),
      );
    }
    rows.push(row);
  }
  return rows;
}

function checkWin(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every((c) => c) ? "draw" : null;
}

export const name = "tictactoe";
export const description = "Tic tac toe vs another user";
export const usage = "!tictactoe @user";
export const category = "games";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "tictactoe", "heavy"))) return;
  const opponent = message.mentions.users.first();
  if (!opponent || opponent.bot || opponent.id === message.author.id) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Mention a real user")] });
  }
  const game = {
    board: Array(9).fill(null),
    players: [message.author.id, opponent.id],
    turn: 0,
  };
  games.set(`${message.channelId}`, game);
  const embed = baseEmbed(COLORS.info)
    .setTitle("❌⭕ Tic Tac Toe")
    .setDescription(`**${message.author.username}** (❌) vs **${opponent.username}** (⭕)\n\nTurn: **${message.author.username}**`);
  await message.reply({ content: `${opponent}`, embeds: [embed], components: buildBoard(game.board) });
}

export async function handleTttButton(interaction) {
  if (!interaction.customId.startsWith("ttt_")) return false;
  const [_, idxStr] = interaction.customId.split("_");
  const idx = parseInt(idxStr, 10);
  const game = games.get(`${interaction.channelId}`);
  if (!game) {
    return interaction.reply({ content: "❌ No active game in this channel", ephemeral: true });
  }
  if (!game.players.includes(interaction.user.id)) {
    return interaction.reply({ content: "❌ Not your game", ephemeral: true });
  }
  const playerIdx = game.players.indexOf(interaction.user.id);
  if (playerIdx !== game.turn) {
    return interaction.reply({ content: "❌ Not your turn", ephemeral: true });
  }
  if (game.board[idx]) return interaction.reply({ content: "❌ Cell taken", ephemeral: true });
  game.board[idx] = playerIdx === 0 ? "❌" : "⭕";
  game.turn = 1 - game.turn;
  const winner = checkWin(game.board);
  const embed = baseEmbed(winner === "draw" ? COLORS.warning : winner ? COLORS.success : COLORS.info);
  const p1 = await interaction.client.users.fetch(game.players[0]);
  const p2 = await interaction.client.users.fetch(game.players[1]);
  if (winner === "draw") {
    embed.setTitle("🤝 Draw!").setDescription(`**${p1.username}** vs **${p2.username}**\n\nIt's a draw!`);
    games.delete(`${interaction.channelId}`);
    return interaction.update({ embeds: [embed], components: buildBoard(game.board).map((r) => ActionRowBuilder.from(r).setComponents(r.components.map((b) => ButtonBuilder.from(b).setDisabled(true)))) });
  }
  if (winner) {
    const winnerUser = winner === "❌" ? p1 : p2;
    embed.setTitle(`🏆 ${winnerUser.username} Wins!`).setDescription(`**${p1.username}** (❌) vs **${p2.username}** (⭕)`);
    games.delete(`${interaction.channelId}`);
    return interaction.update({ embeds: [embed], components: buildBoard(game.board).map((r) => ActionRowBuilder.from(r).setComponents(r.components.map((b) => ButtonBuilder.from(b).setDisabled(true)))) });
  }
  const nextUser = game.turn === 0 ? p1 : p2;
  embed.setTitle("❌⭕ Tic Tac Toe").setDescription(`**${p1.username}** (❌) vs **${p2.username}** (⭕)\n\nTurn: **${nextUser.username}**`);
  await interaction.update({ embeds: [embed], components: buildBoard(game.board) });
  return true;
}
