import { createPlaytest, parseWhen } from "../../features/roblox.js";
import { memberAllowed } from "../../features/config.js";

export const name = "playtest";
export const description = "Schedule a playtest with I'm in / Can't make it buttons, a 30-min ping and the tester VC";
export const usage = "!playtest schedule <when> <duration> <build> | <what to test>   — when: \"2026-10-12 18:00\" (UTC), \"in 2h\" or <t:unix>; duration: 60m / 2h";
export const category = "mod";

export async function execute(message) {
  if (!memberAllowed(message.member, "playtest_host_roles", null)) return message.reply("You can't schedule playtests.");
  let raw = message.content.replace(/^!playtest\s*/i, "").replace(/^schedule\s+/i, "");
  const [head, ...rest] = raw.split("|");
  const notes = rest.join("|").trim();
  // when = first match of a supported time format
  const m = /^(\d{4}-\d{2}-\d{2}[ t]\d{1,2}:\d{2}|in\s+\d+\s*\w+|<t:\d+(?::\w)?>|\d{10})\s*(.*)$/i.exec(head.trim());
  if (!m) return message.reply(`Usage: \`${usage}\``);
  const at = parseWhen(m[1]);
  if (!at || at < Date.now()) return message.reply("That time is in the past or not understood (UTC: `2026-10-12 18:00`).");
  const after = m[2].trim().split(/\s+/);
  let durationMin = 60;
  const d = /^(\d+)\s*(m|min|h|hr)$/i.exec(after[0] || "");
  if (d) { durationMin = parseInt(d[1], 10) * (/^h/i.test(d[2]) ? 60 : 1); after.shift(); }
  const build = after.join(" ").trim() || null;
  const res = await createPlaytest(message.guild, message.author, at, durationMin, notes, build);
  if (res.error) return message.reply(`❌ ${res.error}`);
  return message.reply(`✅ Playtest posted: ${res.message.url}`);
}
