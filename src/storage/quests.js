import { updateUser, getUser } from "../storage/users.js";

// Daily quests: each user gets 3 random quests each day. Completed = payout.
// Stored on the user record as { questProgress: [{type, target, current, reward, claimed}], questDate: "yyyy-mm-dd" }

const QUEST_POOL = [
  { type: "work",     target: 3,  reward: 600 },
  { type: "search",   target: 5,  reward: 400 },
  { type: "fish",     target: 5,  reward: 500 },
  { type: "beg",      target: 3,  reward: 300 },
  { type: "gamble",   target: 3,  reward: 800 },
  { type: "trivia",   target: 2,  reward: 500 },
  { type: "minigames",target: 3,  reward: 500 },
  { type: "lucky",    target: 1,  reward: 200 },
  { type: "collect",  target: 1,  reward: 250 },
];

export function today() { return new Date().toISOString().slice(0, 10); }

export function rollQuests(userId) {
  const pool = [...QUEST_POOL];
  // Pick 3 distinct
  const picks = [];
  while (picks.length < 3 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    picks.push(pool[i]);
    pool.splice(i, 1);
  }
  const quests = picks.map((q) => ({ type: q.type, target: q.target, reward: q.reward, current: 0, claimed: false }));
  updateUser(userId, (d) => {
    d.questDate = today();
    d.questProgress = quests;
    return d;
  });
  return quests;
}

export function getQuests(userId) {
  const u = getUser(userId);
  if (u.questDate !== today()) return rollQuests(userId);
  if (!Array.isArray(u.questProgress)) return rollQuests(userId);
  return u.questProgress;
}

export function progressQuest(userId, type, incrementAmt = 1) {
  const u = getUser(userId);
  if (u.questDate !== today()) { rollQuests(userId); }
  let completedQuest = null;
  updateUser(userId, (d) => {
    if (d.questDate !== today() || !Array.isArray(d.questProgress)) {
      d = { ...d, questDate: today(), questProgress: rollQuestsRaw() };
    }
    for (const q of d.questProgress) {
      if (q.type !== type || q.claimed || q.current >= q.target) continue;
      q.current = Math.min(q.target, (q.current || 0) + incrementAmt);
      if (q.current >= q.target) {
        q.claimed = true;
        completedQuest = q;
      }
    }
    return d;
  });
  return completedQuest;
}

function rollQuestsRaw() {
  const pool = [...QUEST_POOL];
  const picks = [];
  while (picks.length < 3 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    picks.push(pool[i]);
    pool.splice(i, 1);
  }
  return picks.map((q) => ({ type: q.type, target: q.target, reward: q.reward, current: 0, claimed: false }));
}
