import { removeFromCache } from "../storage/inviteCache.js";

export const name = "inviteDelete";

export async function execute(invite) {
  if (invite.guild) removeFromCache(invite.guild.id, invite.code);
}
