import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "members";
export const description = "Show member count breakdown";
export const usage = "!members";
export const category = "utility";

export async function execute(message) {
  if (!message.guild) return message.reply("This command only works in a server.");
  // guild.fetch() returns Discord's approximate online count, which works without the presence intent.
  const g = await message.guild.fetch();
  const members = await message.guild.members.fetch().catch(() => message.guild.members.cache);
  const bots = members.filter((m) => m.user.bot).size;
  const total = g.memberCount;
  const embed = baseEmbed(COLORS.success)
    .setTitle(`👥 ${g.name} Members`)
    .addFields(
      { name: "Total", value: `${total}`, inline: true },
      { name: "Humans", value: `${total - bots}`, inline: true },
      { name: "Bots", value: `${bots}`, inline: true },
      { name: "🟢 Online (approx.)", value: `${g.approximatePresenceCount ?? "—"}`, inline: true },
    );
  await message.reply({ embeds: [embed] });
}
