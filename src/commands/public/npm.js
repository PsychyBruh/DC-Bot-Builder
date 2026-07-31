import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "npm";
export const description = "Get npm package info";
export const usage = "!npm <package>";
export const category = "utility";

export async function execute(message, args) {
  const pkg = args.join(" ").trim();
  if (!pkg) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide a package: `!npm discord.js`")] });
  }
  try {
    const r = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`);
    if (!r.ok) {
      return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("❌ Package not found")] });
    }
    const d = await r.json();
    const latest = d.versions[d["dist-tags"].latest];
    const embed = baseEmbed(COLORS.danger)
      .setTitle(`📦 ${d.name}`)
      .setURL(`https://npmjs.com/package/${d.name}`)
      .setDescription((d.description || "No description").slice(0, 500))
      .addFields(
        { name: "🏷️ Version", value: d["dist-tags"].latest, inline: true },
        { name: "📜 License", value: d.license || "Unknown", inline: true },
        { name: "📊 Weekly DLs", value: "—", inline: true },
        { name: "📅 Published", value: `<t:${Math.floor(new Date(d.time[d["dist-tags"].latest]).getTime() / 1000)}:R>`, inline: true },
        { name: "🔗 Repo", value: latest.repository?.url ? `[link](${latest.repository.url.replace(/^git\+/, "").replace(/\.git$/, "")})` : "—", inline: true },
      )
      .setFooter({ text: "npm registry" });
    await message.reply({ embeds: [embed] });
  } catch (err) {
    await message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Failed: ${err.message}`)] });
  }
}
