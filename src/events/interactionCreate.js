import { getButtonAction } from "../storage/buttonActions.js";

export const name = "interactionCreate";

export async function execute(interaction, client) {
  try {
    await _executeImpl(interaction, client);
  } catch (err) {
    console.error("interactionCreate error:", err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "This button had an error: " + (err && err.message || "unknown"), ephemeral: true });
      } else {
        await interaction.reply({ content: "This button had an error: " + (err && err.message || "unknown"), ephemeral: true });
      }
    } catch {}
  }
}

async function _executeImpl(interaction, client) {
  if (!interaction.isButton()) return;

  const id = interaction.customId;

  if (id.startsWith("ttt_")) {
    const { handleTttButton } = await import("../commands/public/tictactoe.js");
    await handleTttButton(interaction);
    return;
  }

  if (id.startsWith("ms_")) {
    const { handleMinesweeperButton } = await import("../commands/public/minesweeper.js");
    await handleMinesweeperButton(interaction);
    return;
  }

  if (id.startsWith("help_")) {
    const { handleHelpButton } = await import("../commands/public/help.js");
    await handleHelpButton(interaction, { client });
    return;
  }

  if (id.startsWith("ap_")) {
    const { handleAdminPanelButton } = await import("../commands/admin/admin-panel.js");
    await handleAdminPanelButton(interaction, { client });
    return;
  }

  if (id.startsWith("c4d_")) {
    const { handleConnect4Button } = await import("../commands/public/connect4.js");
    await handleConnect4Button(interaction);
    return;
  }

  if (id.startsWith("bj_")) {
    const { handleBlackjackButton } = await import("../commands/public/blackjack.js");
    await handleBlackjackButton(interaction);
    return;
  }

  if (id.startsWith("rps_")) {
    const { handleRpsButton } = await import("../commands/public/rps.js");
    await handleRpsButton(interaction);
    return;
  }

  if (id.startsWith("dl_")) {
    const { handleDuelButton } = await import("../commands/public/duel.js");
    await handleDuelButton(interaction);
    return;
  }

  if (id === "g_up" || id === "g_down" || id === "g_left" || id === "g_right") {
    const { handle2048Button } = await import("../commands/public/2048.js");
    await handle2048Button(interaction);
    return;
  }

  const action = getButtonAction(id);
  if (!action) {
    try { await interaction.reply({ content: "This button is no longer active.", ephemeral: true }); } catch {}
    return;
  }

  if (interaction.guildId !== action.guildId) {
    try { await interaction.reply({ content: "This button doesn't work in this server.", ephemeral: true }); } catch {}
    return;
  }

  const member = interaction.member;
  if (!member) {
    try { await interaction.reply({ content: "Could not find your member data.", ephemeral: true }); } catch {}
    return;
  }

  const addRoles = action.addRoleIds.map((id) => interaction.guild.roles.cache.get(id)).filter(Boolean);
  const removeRoles = action.removeRoleIds.map((id) => interaction.guild.roles.cache.get(id)).filter(Boolean);

  try {
    if (removeRoles.length) await member.roles.remove(removeRoles);
    if (addRoles.length) await member.roles.add(addRoles);
  } catch (err) {
    try { await interaction.reply({ content: `Failed to update roles: ${err.message}`, ephemeral: true }); } catch {}
    return;
  }

  const added = addRoles.map((r) => r.name).join(", ");
  const removed = removeRoles.map((r) => r.name).join(", ");
  const parts = [];
  if (removed) parts.push(`Removed: ${removed}`);
  if (added) parts.push(`Added: ${added}`);
  try { await interaction.reply({ content: parts.join("\n") || "Done!", ephemeral: true }); } catch {}
}
