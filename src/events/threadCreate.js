export const name = "threadCreate";

export async function execute(thread, newlyCreated) {
  if (!newlyCreated || !thread.guild) return;
  const { handleNewForumThread } = await import("../features/clean.js");
  const { onNewSuggestionThread } = await import("../features/forumSuggestions.js");
  const { onNewBugThread } = await import("../features/bugs.js");
  await onNewSuggestionThread(thread);
  await onNewBugThread(thread);
  await handleNewForumThread(thread);
}
