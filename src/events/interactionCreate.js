import { getButtonAction } from "../storage/buttonActions.js";

export const name = "interactionCreate";

export async function execute(interaction, client) {
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
