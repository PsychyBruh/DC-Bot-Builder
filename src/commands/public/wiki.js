import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "wiki";
export const description = "Search Wikipedia";
export const usage = "!wiki <query>";
export const category = "utility";

export async function execute(message, args) {
  const query = args.join(" ");
  if (!query) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide a query: `!wiki cats`")] });
  }
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
    if (r.status === 404) {
      return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`❌ No Wikipedia article for "${query}"`)] });
    }
    if (!r.ok) {
      return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Wikipedia error: ${r.status}`)] });
    }
    const d = await r.json();
    const extract = (d.extract || "").slice(0, 1500);
    const embed = baseEmbed(COLORS.info)
      .setTitle(`📚 ${d.title}`)
      .setURL(d.content_urls?.desktop?.page || "")
      .setDescription(extract + (extract.length === 1500 ? "..." : ""))
      .setThumbnail(d.thumbnail?.source)
      .setFooter({ text: "Wikipedia" });
    await message.reply({ embeds: [embed] });
  } catch (err) {
    await message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Failed: ${err.message}`)] });
  }
}
