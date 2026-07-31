import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "members";
export const description = "Show member count breakdown";
export const usage = "!members";
export const category = "utility";

export async function execute(message) {
  const g = message.guild;
  await g.fetch();
  const online = g.members.cache.filter((m) => m.presence?.status === "online").size;
  const idle = g.members.cache.filter((m) => m.presence?.status === "idle").size;
  const dnd = g.members.cache.filter((m) => m.presence?.status === "dnd").size;
  const offline = g.members.cache.filter((m) => !m.presence || m.presence.status === "offline").size;
  const bots = g.members.cache.filter((m) => m.user.bot).size;
  const humans = g.memberCount - bots;
  const embed = baseEmbed(COLORS.success)
    .setTitle(`👥 ${g.name} Members`)
    .addFields(
      { name: "Total", value: `${g.memberCount}`, inline: true },
      { name: "Humans", value: `${humans}`, inline: true },
      { name: "Bots", value: `${bots}`, inline: true },
      { name: "🟢 Online", value: `${online}`, inline: true },
      { name: "🟡 Idle", value: `${idle}`, inline: true },
      { name: "🔴 DND", value: `${dnd}`, inline: true },
    );
  await message.reply({ embeds: [embed] });
}
