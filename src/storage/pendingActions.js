import { saveLine, loadAll } from "../services/persistence.js";

const pendingActions = new Map();
const pendingVotes = new Map();
let voteCounter = 0;

export function restoreFromDisk() {
  const { pendings } = loadAll();
  const now = Date.now();
  for (const entry of pendings) {
    if (entry.d.createdAt && now - entry.d.createdAt < 300000) {
      if (entry.d._isVote) {
        pendingVotes.set(entry.k, entry.d);
      } else {
        pendingActions.set(entry.k, entry.d);
      }
    }
  }
  console.log(`Restored ${pendingActions.size} pending confirmation(s) and ${pendingVotes.size} pending vote(s) from disk.`);
}

export function setPendingAction(guildId, userId, toolName, params, toolBlockId) {
  const key = `${guildId}:${userId}`;
  const data = { toolName, params, toolBlockId, createdAt: Date.now() };
  pendingActions.set(key, data);
  saveLine("pend", key, data);
}

export function getPendingAction(guildId, userId) {
  const entry = pendingActions.get(`${guildId}:${userId}`);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > 300000) {
    pendingActions.delete(`${guildId}:${userId}`);
    return null;
  }
  return entry;
}

export function clearPendingAction(guildId, userId) {
  pendingActions.delete(`${guildId}:${userId}`);
}

export function setPendingVote(guildId, toolName, params, toolBlockId, requiredApprovals) {
  voteCounter++;
  const key = `${guildId}:vote:${voteCounter}`;
  const data = {
    _isVote: true,
    toolName, params, toolBlockId,
    requiredApprovals,
    approvedBy: [],
    guildId,
    createdAt: Date.now(),
  };
  pendingVotes.set(key, data);
  saveLine("pend", key, data);
  return key;
}

export function getPendingVoteByGuild(guildId) {
  for (const [key, entry] of pendingVotes) {
    if (entry.guildId === guildId && Date.now() - entry.createdAt < 300000) {
      return { key, ...entry };
    }
  }
  return null;
}

export function addApproval(voteKey, userId) {
  const entry = pendingVotes.get(voteKey);
  if (!entry) return null;
  if (entry.approvedBy.includes(userId)) return { alreadyApproved: true, entry };
  entry.approvedBy.push(userId);
  saveLine("pend", voteKey, entry);
  if (entry.approvedBy.length >= entry.requiredApprovals) {
    pendingVotes.delete(voteKey);
    return { approved: true, entry };
  }
  const needed = entry.requiredApprovals - entry.approvedBy.length;
  return { needsMore: true, needed, entry };
}

export function clearVote(voteKey) {
  pendingVotes.delete(voteKey);
}

export function clearAllMemory() {
  pendingActions.clear();
  pendingVotes.clear();
}
