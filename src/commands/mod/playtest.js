import { createPlaytest, parseWhen } from "../../features/roblox.js";
import { isStaff } from "../../features/config.js";

export const name = "playtest";
export const description = "Schedule a playtest with an I'm-in button, 30-min reminder and tester VC";
export const usage = "!playtest <when> [duration] | [notes]   when = \"in 2h\", \"2026-10-12 18:00\" (UTC) or <t:unix>; duration like 60m";
export const category = "mod";

export async function execute(message) {
  if (!isStaff(message.member)) return message.reply("Staff only.");
  const raw = message.content.replace(/^!playtest\s*/i, "");
  const [head, ...noteParts] = raw.split("|");
  const durMatch = /\s(\d+)\s*(m|min|h)$/i.exec(head.trim());
  const whenText = durMatch ? head.trim().slice(0, durMatch.index) : head.trim();
  const durationMin = durMatch ? parseInt(durMatch[1], 10) * (durMatch[2].toLowerCase().startsWith("h") ? 60 : 1) : 60;
  const at = parseWhen(whenText);
  if (!at || at < Date.now()) return message.reply(`Usage: \`${usage}\``);
  const res = await createPlaytest(message.guild, message.author, at, durationMin, noteParts.join("|").trim());
  if (res.error) return message.reply(`❌ ${res.error}`);
  return message.reply(`✅ Playtest posted: ${res.message.url}`);
}
