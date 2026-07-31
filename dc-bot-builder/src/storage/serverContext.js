import { saveLine, loadAll } from "../services/persistence.js";

const serverContexts = new Map();
const conversationHistories = new Map();
const CONVERSATION_TTL = 10 * 60 * 1000;

export function restoreFromDisk() {
  const { contexts, conversations } = loadAll();
  for (const entry of contexts) {
    serverContexts.set(entry.k, entry.d);
  }
  const now = Date.now();
  for (const entry of conversations) {
    const expires = entry.d.expires || now + CONVERSATION_TTL;
    if (expires > now) {
      conversationHistories.set(entry.k, { messages: entry.d.messages || entry.d, expires });
    }
  }
  console.log(`Restored ${serverContexts.size} guild context(s) and ${conversationHistories.size} conversation(s) from disk.`);
}

export function getContext(guildId) {
  return serverContexts.get(guildId) || null;
}

export function setContext(guildId, data) {
  serverContexts.set(guildId, data);
  saveLine("ctx", guildId, data);
}

export function deleteContext(guildId) {
  serverContexts.delete(guildId);
  conversationHistories.delete(guildId);
}

export function getConversation(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const entry = conversationHistories.get(key);
  if (entry) {
    entry.expires = Date.now() + CONVERSATION_TTL;
    return entry.messages;
  }
  return [];
}

export function setConversation(guildId, userId, messages) {
  const key = `${guildId}:${userId}`;
  const data = { messages, expires: Date.now() + CONVERSATION_TTL };
  conversationHistories.set(key, data);
  saveLine("conv", key, data);
}

export function appendConversation(guildId, userId, role, content) {
  const messages = getConversation(guildId, userId);
  messages.push({ role, content });
  setConversation(guildId, userId, messages);
}

export function clearAllMemory() {
  serverContexts.clear();
  conversationHistories.clear();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of conversationHistories) {
    if (entry.expires < now) {
      conversationHistories.delete(key);
    }
  }
}, 60 * 1000);
