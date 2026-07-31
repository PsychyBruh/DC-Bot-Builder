import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "serverinfo";
export const description = "Server information";
export const usage = "!serverinfo";
export const category = "utility";

export async function execute(message) {
  const g = message.guild;
  await g.fetch();
  const owner = await g.fetchOwner().catch(() => null);
  const embed = baseEmbed(COLORS.info)
    .setTitle(`🏠 ${g.name}`)
    .setThumbnail(g.iconURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: "👑 Owner", value: owner ? `<@${owner.id}>` : "Unknown", inline: true },
      { name: "📅 Created", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true },
      { name: "🆔 ID", value: g.id, inline: true },
      { name: "👥 Members", value: `${g.memberCount}`, inline: true },
      { name: "🎭 Roles", value: `${g.roles.cache.size}`, inline: true },
      { name: "💬 Channels", value: `${g.channels.cache.size}`, inline: true },
      { name: "🚀 Boost", value: `Tier ${g.premiumTier} (${g.premiumSubscriptionCount} boosts)`, inline: true },
    )
    .setFooter({ text: "Server stats" });
  await message.reply({ embeds: [embed] });
}
