import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const games = new Map();
const SIZE = 4;
const TILE_COLORS = {
  2: 0xE8E8E8, 4: 0xF5E1A4, 8: 0xF5C242, 16: 0xF58A42,
  32: 0xF55742, 64: 0xE8452B, 128: 0xF5E642, 256: 0xF5D442,
  512: 0xF5A442, 1024: 0xF58442, 2048: 0xF56242, 4096: 0x3CB371,
};

function newBoard() {
  const b = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
  return b;
}
function emptyCells(b) {
  const cells = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!b[r][c]) cells.push([r, c]);
  return cells;
}
function spawn(b) {
  const cells = emptyCells(b);
  if (!cells.length) return;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  b[r][c] = Math.random() < 0.9 ? 2 : 4;
}
function slideRow(row) {
  const vals = row.filter((v) => v);
  const out = [];
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === vals[i + 1]) { out.push(vals[i] * 2); i++; }
    else out.push(vals[i]);
  }
  while (out.length < SIZE) out.push(0);
  return out;
}
function move(b, dir) {
  let changed = false;
  const newB = b.map((row) => [...row]);
  const trans = dir === "up" || dir === "down";
  const reverse = dir === "right" || dir === "down";
  for (let i = 0; i < SIZE; i++) {
    let col = [];
    for (let j = 0; j < SIZE; j++) col.push(trans ? b[j][i] : b[i][j]);
    if (reverse) col.reverse();
    const slid = slideRow(col);
    if (reverse) slid.reverse();
    for (let j = 0; j < SIZE; j++) {
      const val = trans ? slid[j] : slid[j];
      if (trans) newB[j][i] = val;
      else newB[i][j] = val;
      if (newB[i][j] !== (trans ? b[j][i] : b[i][j])) changed = true;
    }
  }
  return { board: newB, changed };
}
function hasMoves(b) {
  if (emptyCells(b).length) return true;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (c + 1 < SIZE && b[r][c] === b[r][c + 1]) return true;
    if (r + 1 < SIZE && b[r][c] === b[r + 1][c]) return true;
  }
  return false;
}

export const name = "2048";
export const description = "Play 2048 (4x4) — merge tiles to reach 2048";
export const usage = "!2048";
export const category = "games";

export function stopSession(channelId, userId) {
  return games.delete(`${channelId}:${userId}`);
}

function boardEmbed(board, score, maxTile, over) {
  const lines = board.map((row) => row.map((v) => String(v || "·").padStart(4)).join("  ")).map((l) => `\`${l}\``);
  const embed = baseEmbed(over ? COLORS.danger : COLORS.primary)
    .setTitle("🎮 2048")
    .setDescription(lines.join("\n"))
    .setFooter({ text: `Score: ${score}  •  Best: ${maxTile}${over ? "  •  Game Over!" : ""}` });
  return embed;
}

function controls(disabled = false) {
  const upRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("g_up").setLabel("⬆️").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  );
  const midRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("g_left").setLabel("⬅️").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("g_down").setLabel("⬇️").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("g_right").setLabel("➡️").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  );
  return [upRow, midRow];
}

export async function execute(message) {
  if (!(await applyCooldown(message, "2048", "game"))) return;
  const b = newBoard();
  spawn(b); spawn(b);
  games.set(`${message.channelId}:${message.author.id}`, { board: b, score: 0, best: 0 });
  const embed = boardEmbed(b, 0, 0, false);
  await message.reply({ embeds: [embed], components: controls() });
}

export async function handle2048Button(interaction) {
  const dir = interaction.customId;
  if (!["g_up", "g_down", "g_left", "g_right"].includes(dir)) return false;
  const game = games.get(`${interaction.channelId}:${interaction.user.id}`);
  if (!game) return interaction.reply({ content: "❌ No game in this channel", ephemeral: true });
  const { board, changed } = move(game.board, dir.replace("g_", ""));
  if (changed) {
    game.board = board;
    spawn(board);
    game.score += board.flat().reduce((a, v) => a + (v > 0 ? v : 0), 0);
    game.best = Math.max(game.best, ...board.flat());
  }
  const over = !hasMoves(board);
  const embed = boardEmbed(board, game.score, game.best, over);
  if (over) {
    games.delete(`${interaction.channelId}:${interaction.user.id}`);
    return interaction.update({ embeds: [embed], components: controls(true) });
  }
  await interaction.update({ embeds: [embed], components: controls() });
  return true;
}
