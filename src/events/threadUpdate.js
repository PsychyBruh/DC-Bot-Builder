export const name = "threadUpdate";

export async function execute(oldThread, newThread) {
  if (!newThread.guild) return;
  const { handleForumThreadUpdate } = await import("../features/clean.js");
  await handleForumThreadUpdate(oldThread, newThread);
}
