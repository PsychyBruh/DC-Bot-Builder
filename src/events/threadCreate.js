export const name = "threadCreate";

export async function execute(thread, newlyCreated) {
  if (!newlyCreated || !thread.guild) return;
  const { handleNewForumThread } = await import("../features/clean.js");
  await handleNewForumThread(thread);
}
