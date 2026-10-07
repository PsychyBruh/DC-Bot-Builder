import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { featureData, saveFeatures, resolveChannel } from "./config.js";
import { getSettings } from "../storage/serverSettings.js";

// Settings: starboard_channel, starboard_threshold (default 3), starboard_emoji (default ⭐),
// starboard_media_only ("true" = only messages with images/videos)
export async function handleStarReaction(reaction, user) {
  if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
  const message = reaction.message.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
  const guild = message?.guild;
  if (!guild) return;
  const settings = getSettings(guild.id);
  const emoji = settings.starboard_emoji || "⭐";
  if ((reaction.emoji.id || reaction.emoji.name) !== (emoji.match(/:(\d+)>$/)?.[1] || emoji)) return;
  const board = resolveChannel(guild, "starboard_channel", ["starboard", "hall-of-fame", "halloffame", "best-of"]);
  if (!board || message.channelId === board.id || message.author?.bot) return;
  if (settings.starboard_disabled === "true") return;

  const media = [...message.attachments.values()].find((a) => /^(image|video)\//.test(a.contentType || "")) ||
    message.embeds.find((e) => e.image || e.thumbnail || e.video);
  if (settings.starboard_media_only === "true" && !media) return;

  // Self-stars don't count
  const users = await reaction.users.fetch().catch(() => null);
  const count = users ? users.filter((u) => !u.bot && u.id !== message.author.id).size : reaction.count;
  const threshold = Math.max(1, parseInt(settings.starboard_threshold, 10) || 3);
  const posted = featureData(guild.id, "starboard", {});
  const existingId = posted[message.id];

  const embed = baseEmbed(COLORS.gold)
    .setAuthor({ name: message.member?.displayName || message.author.username, iconURL: message.author.displayAvatarURL() })
    .setDescription(`${message.content || ""}\n\n[Jump to message](${message.url})`)
    .setFooter({ text: `#${message.channel.name}` })
    .setTimestamp(message.createdTimestamp);
  const img = media?.url || media?.image?.url || media?.thumbnail?.url;
  if (img && !/^video\//.test(media.contentType || "")) embed.setImage(img);
  const content = `${emoji} **${count}** · <#${message.channelId}>${/^video\//.test(media?.contentType || "") ? `\n${media.url}` : ""}`;

  if (existingId) {
    const sm = await board.messages.fetch(existingId).catch(() => null);
    if (!sm) return;
    if (count < threshold) { await sm.delete().catch(() => {}); delete posted[message.id]; saveFeatures(); return; }
    await sm.edit({ content, embeds: [embed] }).catch(() => {});
  } else if (count >= threshold) {
    const sm = await board.send({ content, embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
    if (sm) { posted[message.id] = sm.id; saveFeatures(); }
  }
}
