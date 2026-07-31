import { getButtonAction } from "../storage/buttonActions.js";

export const name = "interactionCreate";

export async function execute(interaction) {
  if (!interaction.isButton()) return;

  const action = getButtonAction(interaction.customId);
  if (!action) {
    await interaction.reply({ content: "This button is no longer active.", ephemeral: true });
    return;
  }

  if (interaction.guildId !== action.guildId) {
    await interaction.reply({ content: "This button doesn't work in this server.", ephemeral: true });
    return;
  }

  const member = interaction.member;
  if (!member) {
    await interaction.reply({ content: "Could not find your member data.", ephemeral: true });
    return;
  }

  const addRoles = action.addRoleIds
    .map((id) => interaction.guild.roles.cache.get(id))
    .filter(Boolean);
  const removeRoles = action.removeRoleIds
    .map((id) => interaction.guild.roles.cache.get(id))
    .filter(Boolean);

  try {
    if (removeRoles.length) await member.roles.remove(removeRoles);
    if (addRoles.length) await member.roles.add(addRoles);
  } catch (err) {
    await interaction.reply({ content: `Failed to update roles: ${err.message}`, ephemeral: true });
    return;
  }

  const added = addRoles.map((r) => r.name).join(", ");
  const removed = removeRoles.map((r) => r.name).join(", ");
  const parts = [];
  if (removed) parts.push(`Removed: ${removed}`);
  if (added) parts.push(`Added: ${added}`);
  await interaction.reply({ content: parts.join("\n") || "Done!", ephemeral: true });
}
