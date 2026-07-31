import { updateCacheForInvite } from "../storage/inviteCache.js";

export const name = "inviteCreate";

export async function execute(invite) {
  updateCacheForInvite(invite.guild.id, invite);
}
