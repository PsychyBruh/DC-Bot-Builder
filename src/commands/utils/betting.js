import { baseEmbed, COLORS, EMOJIS } from "./embeds.js";
import { adjustBalance } from "../../storage/users.js";

export const MIN_BET = 1;
export const MAX_BET = 50000;

// Parse a bet argument. Returns { bet } or { error }.
// Only plain positive integers in [MIN_BET, MAX_BET] are accepted.
export function parseBet(raw, fallback = null) {
  if (raw === undefined || raw === null || raw === "") {
    if (fallback !== null) return { bet: fallback };
    return { error: `Please provide a bet (${MIN_BET}-${MAX_BET.toLocaleString()}).` };
  }
  const s = String(raw).replace(/,/g, "");
  if (!/^\d+$/.test(s)) return { error: `Bet must be a whole number between ${MIN_BET} and ${MAX_BET.toLocaleString()}.` };
  const bet = parseInt(s, 10);
  if (!Number.isSafeInteger(bet) || bet < MIN_BET) return { error: `Bet must be at least ${MIN_BET}.` };
  if (bet > MAX_BET) return { error: `Maximum bet is ${MAX_BET.toLocaleString()} coins.` };
  return { bet };
}

// Advance the daily "gamble" quest and announce completion.
export async function advanceGambleQuest(userId, channel) {
  try {
    const { progressQuest } = await import("../../storage/quests.js");
    const c = progressQuest(userId, "gamble");
    if (c) {
      adjustBalance(userId, c.reward);
      await channel.send({ embeds: [baseEmbed(COLORS.success).setTitle(`\u{1F4DC} Quest Complete!`).setDescription(`\`gamble ${c.target}x\` done! ${EMOJIS.coin} **${c.reward.toLocaleString()}** reward credited.`)] }).catch(() => {});
    }
  } catch {}
}
