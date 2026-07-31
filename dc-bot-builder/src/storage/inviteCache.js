const inviteCache = new Map();

export function cacheInvites(guildId, invites) {
  const byCode = new Map();
  for (const inv of invites.values()) {
    byCode.set(inv.code, { uses: inv.uses, maxUses: inv.maxUses, inviterId: inv.inviter?.id });
  }
  inviteCache.set(guildId, byCode);
}

export function getCachedInvites(guildId) {
  return inviteCache.get(guildId) || new Map();
}

export function updateCacheForInvite(guildId, invite) {
  const byCode = inviteCache.get(guildId) || new Map();
  byCode.set(invite.code, { uses: invite.uses, maxUses: invite.maxUses, inviterId: invite.inviter?.id });
  inviteCache.set(guildId, byCode);
}

export function removeFromCache(guildId, code) {
  const byCode = inviteCache.get(guildId);
  if (byCode) byCode.delete(code);
}
