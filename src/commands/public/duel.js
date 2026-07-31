import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance, updateUser } from "../../storage/users.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const games = new Map();
const MAX_HP = 100;
const TURN_TIMEOUT_MS = 60000;
const CHALLENGE_TIMEOUT_MS = 30000;

export const name = "duel";
export const description = "Interactive turn-based battle vs another user. !duel @user <wager>";
export const usage = "!duel @user <amount>";
export const category = "games";

export function stopSession(channelId, userId) {
  const g = games.get(channelId);
  if (!g) return false;
  if (g.players.includes(userId)) {
    games.delete(channelId);
    return true;
  }
  return false;
}

function hpBar(hp) {
  const filled = Math.round((hp / MAX_HP) * 10);
  return `[${"\u{2593}".repeat(filled)}${"\u{2591}".repeat(10 - filled)}] ${hp}/${MAX_HP} HP`;
}

function actionRow(picksDisabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dl_atk_${Date.now()}`)
      .setLabel("Attack")
      .setEmoji("\u2694\uFE0F")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(picksDisabled),
    new ButtonBuilder()
      .setCustomId(`dl_def_${Date.now()}`)
      .setLabel("Defend")
      .setEmoji("\u{1F6E1}\uFE0F")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(picksDisabled),
    new ButtonBuilder()
      .setCustomId(`dl_spc_${Date.now()}`)
      .setLabel("Special")
      .setEmoji("\u2728")
      .setStyle(ButtonStyle.Success)
      .setDisabled(picksDisabled),
  );
}

function disabledRow() {
  const r = actionRow(true);
  return r;
}

function buildBattleEmbed(game, log) {
  const [p1, p2] = game.players;
  const emb = baseEmbed(COLORS.gold)
    .setTitle(`\u{1F3C6} Battle: ${p1.username} vs ${p2.username}`)
    .addFields(
      { name: `${p1.username}`, value: hpBar(game.hp[0]), inline: true },
      { name: `${p2.username}`, value: hpBar(game.hp[1]), inline: true },
    );
  // show last 3 log lines
  const recent = log.slice(-3).join("\n");
  emb.setDescription(recent || "Battle starting!");
  // mark whose turn
  emb.setFooter({ text: `Turn: ${game.players[game.turn].username}` });
  return emb;
}

async function finishGame(message, game, channel, winnerIdx, loserIdx) {
  games.delete(channel.id);
  // refund wagers on a draw
  if (winnerIdx === -1) {
    adjustBalance(game.players[0].id, game.wager);
    adjustBalance(game.players[1].id, game.wager);
    const emb = baseEmbed(COLORS.warning)
      .setTitle("\u{1F91D} Draw!")
      .setDescription(`Both combatants fell!\n\nWagers refunded.\n\n${hpBar(game.hp[0])} | ${game.players[0].username}\n${hpBar(game.hp[1])} | ${game.players[1].username}`);
    await channel.send({ embeds: [emb], components: [disabledRow()] });
    return;
  }
  adjustBalance(game.players[winnerIdx].id, game.wager * 2);
  updateUser(game.players[winnerIdx].id, (u) => { u.duelsWon = (u.duelsWon || 0) + 1; });
  updateUser(game.players[loserIdx].id, (u) => { u.duelsLost = (u.duelsLost || 0) + 1; });
  const win = game.players[winnerIdx];
  const lose = game.players[loserIdx];
  const emb = baseEmbed(COLORS.success)
    .setTitle(`\u{1F3C6} ${win.username} wins!`)
    .setDescription(`\u{1F4B0} **${win.username}** takes **${(game.wager * 2).toLocaleString()}** coins!\n\nFinal HP:\n${hpBar(game.hp[winnerIdx])} ${win.username}\n${hpBar(game.hp[loserIdx])} ${lose.username}`)
    .setFooter({ text: `Loser: ${lose.username}` });
  await channel.send({ embeds: [emb], components: [disabledRow()] });
}

async function applyMove(interaction, game, channel, action) {
  const attackerIdx = game.turn;
  const defenderIdx = 1 - attackerIdx;
  const attacker = game.players[attackerIdx];
  const defender = game.players[defenderIdx];
  let line = "";
  let ended = false;
  let winnerIdx = -1;
  let loserIdx = -1;

  if (action === "atk") {
    let dmg = Math.floor(Math.random() * 11) + 15; // 15-25
    const crit = Math.random() < 0.15;
    if (crit) dmg *= 2;
    if (game.defending[defenderIdx]) {
      dmg = Math.floor(dmg / 2);
      game.defending[defenderIdx] = false;
    }
    game.hp[defenderIdx] = Math.max(0, game.hp[defenderIdx] - dmg);
    line = `\u2694\uFE0F **${attacker.username}** attacks for **${dmg}**${crit ? " \u{1F4A5} CRIT!" : ""}.`;
  } else if (action === "def") {
    game.defending[attackerIdx] = true;
    const heal = Math.floor(Math.random() * 6) + 5; // 5-10
    game.hp[attackerIdx] = Math.min(MAX_HP, game.hp[attackerIdx] + heal);
    line = `\u{1F6E1}\uFE0F **${attacker.username}** defends and heals **${heal}** HP.`;
  } else if (action === "spc") {
    if (game.specUsed[attackerIdx]) {
      return { bad: "Special already used this duel" };
    }
    game.specUsed[attackerIdx] = true;
    if (Math.random() < 0.5) {
      let dmg = Math.floor(Math.random() * 11) + 30; // 30-40
      if (game.defending[defenderIdx]) {
        dmg = Math.floor(dmg / 2);
        game.defending[defenderIdx] = false;
      }
      game.hp[defenderIdx] = Math.max(0, game.hp[defenderIdx] - dmg);
      line = `\u2728 **${attacker.username}** unleashes a special for **${dmg}** damage!`;
    } else {
      line = `\u2728 **${attacker.username}** fumbled the special and did nothing!`;
    }
  }

  game.log.push(line);
  // check end
  if (game.hp[defenderIdx] <= 0 && game.hp[attackerIdx] <= 0) {
    ended = true;
    winnerIdx = -1; loserIdx = -1;
  } else if (game.hp[defenderIdx] <= 0) {
    ended = true; winnerIdx = attackerIdx; loserIdx = defenderIdx;
  } else if (game.hp[attackerIdx] <= 0) {
    ended = true; winnerIdx = defenderIdx; loserIdx = attackerIdx;
  }

  if (ended) {
    game.timer && clearTimeout(game.timer);
    await interaction.update({ embeds: [buildBattleEmbed(game, game.log)], components: [disabledRow()] });
    await finishGame(interaction, game, channel, winnerIdx, loserIdx);
    return { ended: true };
  }

  game.turn = defenderIdx;
  resetTurnTimer(interaction.client, interaction.channelId, channel, interaction.message);
  return { ended: false, embed: buildBattleEmbed(game, game.log) };
}

function resetTurnTimer(client, channelId, channel, botMessage) {
  const game = games.get(channelId);
  if (!game) return;
  if (game.timer) clearTimeout(game.timer);
  game.timer = setTimeout(async () => {
    const g = games.get(channelId);
    if (!g) return;
    // current turn's player forfeits on timeout -> other player wins
    const idleIdx = g.turn;
    const winIdx = 1 - idleIdx;
    const idleUser = g.players[idleIdx];
    g.log.push(`\u23F0 **${idleUser.username}** took too long and forfeits!`);
    try {
      await botMessage.edit({ embeds: [buildBattleEmbed(g, g.log)], components: [disabledRow()] });
    } catch {}
    await finishGame({ client }, g, channel, winIdx, idleIdx);
  }, TURN_TIMEOUT_MS);
}

export async function execute(message, args) {
  if (!(await applyCooldown(message, "duel", "game"))) return;
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Mention an opponent`)] });
  if (target.id === message.author.id) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You can't duel yourself`)] });
  if (target.bot) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You can't duel a bot`)] });
  const wager = parseInt(args.find((a) => /^\d+$/.test(a)), 10) || 0;
  if (wager < 1) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Specify a wager: \`!duel @user 100\``)] });
  const bal1 = getUser(message.author.id).balance || 0;
  const bal2 = getUser(target.id).balance || 0;
  if (bal1 < wager) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't have ${wager} coins (balance: ${bal1.toLocaleString()})`)] });
  if (bal2 < wager) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} ${target.username} doesn't have ${wager} coins`)] });

  // deduct upfront
  adjustBalance(message.author.id, -wager);
  adjustBalance(target.id, -wager);

  const challengeEmbed = baseEmbed(COLORS.gold)
    .setTitle(`\u{1F396}\uFE0F Duel Challenge`)
    .setDescription(`**${message.author.username}** challenges **${target.username}** to a battle for **${wager.toLocaleString()}** coins!\n\n${target}, click **Accept** within 30s to begin.\n\n_Battle: 100 HP each. Pick Attack / Defend / Special each turn._`)
    .setFooter({ text: `Wager: ${wager.toLocaleString()} each (both deducted) | Draw = refunded` });
  const acceptRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`dl_acc_${Date.now()}`).setLabel("Accept").setStyle(ButtonStyle.Success).setEmoji("\u2705"),
    new ButtonBuilder().setCustomId(`dl_dec_${Date.now()}`).setLabel("Decline").setStyle(ButtonStyle.Danger).setEmoji(EMOJIS.cross),
  );
  const challengeMsg = await message.channel.send({ content: `${target}`, embeds: [challengeEmbed], components: [acceptRow] });

  // challenge auto-refund on timeout
  const challengeTimer = setTimeout(() => {
    if (games.get(message.channelId)) return; // game started, leave alone
    adjustBalance(message.author.id, wager);
    adjustBalance(target.id, wager);
    try { challengeMsg.edit({ embeds: [baseEmbed(COLORS.warning).setDescription("\u23F0 Challenge expired. Wagers refunded.")], components: [] }); } catch {}
  }, CHALLENGE_TIMEOUT_MS);

  // store pending challenge so the button handler can find it
  games.set(message.channelId, {
    pending: { challenger: message.author, opponent: target, wager, challengeTimer, challengeMsg },
  });
}

export async function handleDuelButton(interaction) {
  if (!interaction.customId.startsWith("dl_")) return false;
  const channel = interaction.channel;
  const game = games.get(interaction.channelId);

  // --- CHALLENGE ACCEPT/DECLINE ---
  if (interaction.customId.startsWith("dl_acc_") || interaction.customId.startsWith("dl_dec_")) {
    if (!game || !game.pending) {
      try { await interaction.reply({ content: "This challenge has expired.", ephemeral: true }); } catch {}
      return true;
    }
    if (interaction.user.id !== game.pending.opponent.id) {
      try { await interaction.reply({ content: "Only the challenged user can accept/decline.", ephemeral: true }); } catch {}
      return true;
    }
    clearTimeout(game.pending.challengeTimer);
    const { challenger, opponent, wager, challengeMsg } = game.pending;

    if (interaction.customId.startsWith("dl_dec_")) {
      adjustBalance(challenger.id, wager);
      adjustBalance(opponent.id, wager);
      games.delete(interaction.channelId);
      try { await challengeMsg.edit({ embeds: [baseEmbed(COLORS.danger).setDescription(`\u{1F6AB} ${opponent.username} declined the duel. Wagers refunded.`)], components: [] }); } catch {}
      try { await interaction.deferUpdate(); } catch {}
      return true;
    }

    // ACCEPT -> start battle
    const battle = {
      players: [challenger, opponent],
      hp: [MAX_HP, MAX_HP],
      turn: Math.floor(Math.random() * 2),
      defending: [false, false],
      specUsed: [false, false],
      wager,
      log: [`\u{1F3C5} ${challenger.username} vs ${opponent.username} — FIGHT!`],
      timer: null,
    };
    games.set(interaction.channelId, battle);
    const emb = buildBattleEmbed(battle, battle.log);
    try { await interaction.update({ embeds: [emb], components: [actionRow()] }); } catch {}
    resetTurnTimer(interaction.client, interaction.channelId, channel, interaction.message);
    return true;
  }

  // --- BATTLE MOVES ---
  if (!game || game.pending) {
    try { await interaction.reply({ content: "No active battle in this channel.", ephemeral: true }); } catch {}
    return true;
  }
  const action = interaction.customId.split("_")[1]; // atk / def / spc
  if (!game.players.some((p) => p.id === interaction.user.id)) {
    try { await interaction.reply({ content: "You're not in this battle.", ephemeral: true }); } catch {}
    return true;
  }
  const playerIdx = game.players.findIndex((p) => p.id === interaction.user.id);
  if (playerIdx !== game.turn) {
    try { await interaction.reply({ content: "Not your turn!", ephemeral: true }); } catch {}
    return true;
  }
  const result = await applyMove(interaction, game, channel, action);
  if (result.bad) {
    try { await interaction.reply({ content: `\u{274C} ${result.bad}`, ephemeral: true }); } catch {}
    return true;
  }
  if (result.ended) return true;
  try { await interaction.update({ embeds: [result.embed], components: [actionRow()] }); } catch {}
  return true;
}
