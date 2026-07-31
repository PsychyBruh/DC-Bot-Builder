import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "userinfo";
export const description = "User information";
export const usage = "!userinfo [@user]";
export const category = "utility";

export async function execute(message) {
  const user = message.mentions.users.first() || message.author;
  const member = await message.guild.members.fetch(user.id).catch(() => null);
  const fields = [
    { name: "📛 Username", value: user.username, inline: true },
    { name: "🆔 ID", value: user.id, inline: true },
    { name: "🤖 Bot", value: user.bot ? "Yes" : "No", inline: true },
  ];
  if (member) {
    fields.push({ name: "📅 Joined Server", value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true });
    fields.push({ name: "📆 Account Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true });
    if (member.roles.cache.size > 1) {
      const roles = member.roles.cache
        .filter((r) => r.id !== message.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => `<@&${r.id}>`)
        .slice(0, 10);
      fields.push({ name: `🎭 Roles [${member.roles.cache.size - 1}]`, value: roles.join(" ") || "None", inline: false });
    }
  }
  const embed = baseEmbed(COLORS.info)
    .setTitle(`ℹ️ ${user.username}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(fields);
  await message.reply({ embeds: [embed] });
}
