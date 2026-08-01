import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { rewardCoins } from "../../storage/economy.js";

// In-memory map: guildId -> { channelId, ts } of the most recently active text channel.
// Updated by messageCreate via recordActivity(). Used by startDropEvent() to know where to post.
const activeChannels = new Map();
const MIN_INTERVAL = 30 * 60 * 1000; // 30 min minimum between drops
const MAX_INTERVAL = 60 * 60 * 1000; // 60 min maximum (drop randomized in this window)
const REACTION_WINDOW = 45_000; // first to react wins
const PRIZE = 500;

export function recordActivity(message) {
  if (!message.guild) return;
  activeChannels.set(message.guild.id, { channelId: message.channel.id, ts: Date.now() });
}

export function startDropEvent(client) {
  scheduleNext(client);
}

function scheduleNext(client) {
  const delay = MIN_INTERVAL + Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL));
  setTimeout(() => {
    fireDrop(client).finally(() => scheduleNext(client));
  }, delay);
}

async function fireDrop(client) {
  try {
    // Pick a guild that has had activity in the last 2 hours
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const candidates = [...activeChannels.values()].filter((c) => c.ts > cutoff);
    if (!candidates.length) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const channel = client.channels.cache.get(pick.channelId);
    if (!channel || !channel.isSendable?.() || !channel.permissionsFor?.(channel.guild?.members?.me)?.has("SendMessages")) return;

    const embed = baseEmbed(COLORS.gold)
      .setTitle(`${EMOJIS.gift} Coin Drop!`)
      .setDescription(`First person to react with ${EMOJIS.coin} wins **${PRIZE.toLocaleString()}** coins!\n\nYou have 45 seconds.`)
      .setFooter({ text: "Drop events fire randomly every 30-60 min in active channels" });

    const msg = await channel.send({ embeds: [embed] });
    await msg.react(EMOJIS.coin.replace(/\uFE0F/g, "")).catch(() => msg.react(EMOJIS.coin));

    const filter = (r, user) => !user.bot;
    const collected = await msg.awaitReactions({ filter, time: REACTION_WINDOW, max: 1, errors: ["time"] }).catch(() => null);

    if (!collected || !collected.size) {
      await msg.reply({ embeds: [baseEmbed(COLORS.warning).setTitle(`${EMOJIS.clock} Drop expired`).setDescription(`Nobody reacted in time. The ${PRIZE} coins vanished.`)] }).catch(() => {});
      return;
    }
    const reaction = collected.first();
    const winner = reaction.users.cache.find((u) => !u.bot);
    if (!winner) return;
    const won = rewardCoins(winner.id, PRIZE);
    await msg.reply({ embeds: [baseEmbed(COLORS.success).setTitle(`${EMOJIS.trophy} Winner!`).setDescription(`<@${winner.id}> reacted first and won ${EMOJIS.coin} **${won.toLocaleString()}**!${won !== PRIZE ? `\n**2x coin boost applied!** (base ${PRIZE.toLocaleString()})` : ""}`)] }).catch(() => {});
  } catch (err) {
    console.error("drop event failed:", err.message);
  }
}
