export const name = "messageReactionRemove";

export async function execute(reaction, user) {
  if (user.bot) return;
  const { handleReactionRole } = await import("../features/roles.js");
  const { handleStarReaction } = await import("../features/starboard.js");
  await handleReactionRole(reaction, user, false);
  await handleStarReaction(reaction, user);
}
