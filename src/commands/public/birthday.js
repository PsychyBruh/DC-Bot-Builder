import { baseEmbed, COLORS } from "../utils/embeds.js";
import { featureData, saveFeatures } from "../../features/config.js";

export const name = "birthday";
export const description = "Opt in to a birthday shout-out + role (date only, no year)";
export const usage = "!birthday set MM-DD  |  !birthday remove  |  !birthday list";
export const category = "social";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function parseDate(s) {
  s = s.trim().toLowerCase();
  let m = /^(\d{1,2})[-/.](\d{1,2})$/.exec(s);
  let mo, d;
  if (m) { mo = +m[1]; d = +m[2]; }
  else if ((m = /^([a-z]{3})[a-z]*\s+(\d{1,2})$/.exec(s))) { mo = MONTHS.indexOf(m[1]) + 1; d = +m[2]; }
  else return null;
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  if (!max || d < 1 || d > max) return null;
  return `${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export async function execute(message, args) {
  const bdays = featureData(message.guild.id, "birthdays", {});
  const sub = (args[0] || "").toLowerCase();
  if (sub === "set") {
    const date = parseDate(args.slice(1).join(" "));
    if (!date) return message.reply("Use `!birthday set MM-DD` (e.g. `!birthday set 07-14` or `!birthday set jul 14`).");
    bdays[message.author.id] = date;
    saveFeatures();
    return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`🎂 Saved! You'll get a shout-out on **${MONTHS[+date.slice(0, 2) - 1].toUpperCase()} ${+date.slice(3)}**.`)] });
  }
  if (sub === "remove") {
    delete bdays[message.author.id];
    saveFeatures();
    return message.reply("Removed your birthday.");
  }
  if (sub === "list") {
    const today = new Date();
    const key = (d) => { const [mo, da] = d.split("-").map(Number); let t = Date.UTC(today.getUTCFullYear(), mo - 1, da); if (t < Date.now() - 86400000) t = Date.UTC(today.getUTCFullYear() + 1, mo - 1, da); return t; };
    const upcoming = Object.entries(bdays).sort((a, b) => key(a[1]) - key(b[1])).slice(0, 10);
    return message.reply({ embeds: [baseEmbed(COLORS.pink).setTitle("🎂 Upcoming birthdays").setDescription(upcoming.map(([u, d]) => `<@${u}> — ${MONTHS[+d.slice(0, 2) - 1].toUpperCase()} ${+d.slice(3)}`).join("\n") || "Nobody yet — `!birthday set MM-DD`")], allowedMentions: { parse: [] } });
  }
  return message.reply(`Usage: \`${usage}\``);
}
