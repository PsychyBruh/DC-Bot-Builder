import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { featureData, saveFeatures } from "./config.js";

// featureData "sticky": { [channelId]: { text, lastMsgId } }
const pending = new Map(); // channelId -> timeout (debounce bursts of messages)

export function setSticky(guildId, channelId, text) {
  const s = featureData(guildId, "sticky", {});
  s[channelId] = { text, lastMsgId: s[channelId]?.lastMsgId || null };
  saveFeatures();
}

export function removeSticky(guildId, channelId) {
  const s = featureData(guildId, "sticky", {});
  const had = !!s[channelId];
  delete s[channelId];
  saveFeatures();
  return had;
}

export function listStickies(guildId) {
  return featureData(guildId, "sticky", {});
}

async function repost(channel) {
  const s = featureData(channel.guild.id, "sticky", {})[channel.id];
  if (!s) return;
  if (s.lastMsgId) {
    const old = await channel.messages.fetch(s.lastMsgId).catch(() => null);
    if (old) await old.delete().catch(() => {});
  }
  const msg = await channel.send({
    embeds: [baseEmbed(COLORS.warning).setTitle("📌 Pinned note").setDescription(s.text)],
    allowedMentions: { parse: [] },
  }).catch(() => null);
  if (msg) { s.lastMsgId = msg.id; saveFeatures(); }
}

// Called for every message (including bots). Keeps the sticky as the last message in the channel.
export function handleStickyMessage(message) {
  if (!message.guild) return;
  const s = featureData(message.guild.id, "sticky", {})[message.channelId];
  if (!s || message.id === s.lastMsgId) return;
  if (message.author.id === message.client.user.id && message.embeds[0]?.title === "📌 Pinned note") return;
  clearTimeout(pending.get(message.channelId));
  pending.set(message.channelId, setTimeout(() => {
    pending.delete(message.channelId);
    repost(message.channel).catch(() => {});
  }, 4000));
}

export async function postStickyNow(channel) {
  await repost(channel);
}
