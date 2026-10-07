import { applyCooldown } from "../utils/cooldown.js";
import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "github";
export const description = "Get GitHub repo info";
export const usage = "!github <user/repo>";
export const category = "utility";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "github", "social"))) return;
  const repo = (args[0] || "").replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Format: `!github user/repo`")] });
  }
  try {
    const r = await fetch(`https://api.github.com/repos/${repo.split("/").map(encodeURIComponent).join("/")}`, {
      headers: { "User-Agent": "ProjectNova" },
    });
    if (!r.ok) {
      return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("❌ Repo not found")] });
    }
    const d = await r.json();
    const embed = baseEmbed(COLORS.dark)
      .setTitle(`📦 ${d.full_name}`)
      .setURL(d.html_url)
      .setDescription((d.description || "No description").slice(0, 500))
      .setThumbnail(d.owner.avatar_url)
      .addFields(
        { name: "⭐ Stars", value: `${d.stargazers_count.toLocaleString()}`, inline: true },
        { name: "🍴 Forks", value: `${d.forks_count.toLocaleString()}`, inline: true },
        { name: "📥 Open Issues", value: `${d.open_issues_count.toLocaleString()}`, inline: true },
        { name: "📝 Language", value: d.language || "—", inline: true },
        { name: "📅 Created", value: `<t:${Math.floor(new Date(d.created_at).getTime() / 1000)}:R>`, inline: true },
        { name: "🔄 Updated", value: `<t:${Math.floor(new Date(d.updated_at).getTime() / 1000)}:R>`, inline: true },
      );
    await message.reply({ embeds: [embed] });
  } catch (err) {
    await message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Failed: ${err.message}`)] });
  }
}
