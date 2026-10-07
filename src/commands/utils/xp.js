import { addXp } from "../../storage/users.js";
import { activeBooster } from "../../storage/economy.js";

const lastXp = new Map();

export async function handleXp(message) {
  if (message.content.length < 2) return;
  const now = Date.now();
  const last = lastXp.get(message.author.id);
  if (last && now - last < 60_000) return;
  lastXp.set(message.author.id, now);
  if (lastXp.size > 5000) {
    for (const [id, t] of lastXp) if (now - t > 60_000) lastXp.delete(id);
  }
  const baseGain = Math.min(15, 5 + Math.floor(message.content.length / 20));
  const xpGain = activeBooster(message.author.id, "xp") ? baseGain * 2 : baseGain;
  // Global XP drives the economy level bonus (paid silently); the per-server XP drives
  // levels, rank roles and the level-up announcement.
  addXp(message.author.id, xpGain);
  if (message.guild) {
    const { addGuildXp } = await import("../../features/levels.js");
    await addGuildXp(message, xpGain);
  }
}
