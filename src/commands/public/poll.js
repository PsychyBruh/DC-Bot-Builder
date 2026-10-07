import { applyCooldown } from "../utils/cooldown.js";
import { baseEmbed, COLORS } from "../utils/embeds.js";
import { postPoll } from "../../features/voting.js";
import { parseDuration } from "./giveaway.js";

export const name = "poll";
export const description = "Create a button poll with live results. Optional duration closes it automatically.";
export const usage = "!poll [duration] \"question\" \"opt1\" \"opt2\" ...   or   !poll [duration] question | opt1 | opt2";
export const category = "utility";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "poll", "social"))) return;
  let duration = null;
  if (args[0] && parseDuration(args[0])) duration = parseDuration(args.shift());
  const text = args.join(" ");
  let parts = text.match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1).trim()) || [];
  if (parts.length < 3) parts = text.split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Format: `!poll \"question\" \"opt1\" \"opt2\"` or `!poll question | opt1 | opt2`\nAdd a duration first to auto-close: `!poll 1d Best map? | Desert | Snow`")] });
  }
  const [question, ...options] = parts;
  if (options.length > 10) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Max 10 options")] });
  if (duration && duration > 30 * 86400000) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Polls can run at most 30 days.")] });
  await postPoll(message.channel, message.author, question.slice(0, 250), options.map((o) => o.slice(0, 80)), duration);
  if (message.deletable) await message.delete().catch(() => {});
}
