import { baseEmbed, COLORS } from "../utils/embeds.js";
import { addSchedule, removeSchedule, listSchedules } from "../../features/automation.js";

export const name = "schedule";
export const description = "Recurring posts (times are UTC), incl. Screenshot of the Week";
export const usage = "!schedule daily HH:MM #channel [@role] <message>  |  !schedule weekly <mon..sun> HH:MM #channel [@role] <message>  |  !schedule monthly <1-28> HH:MM #channel [@role] <message>  |  !schedule sotw <day> HH:MM #channel  |  !schedule list  |  !schedule remove <id>";
export const category = "admin";
export const adminOnly = true;

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export async function execute(message, args) {
  const sub = (args[0] || "list").toLowerCase();
  if (sub === "list") {
    const list = listSchedules(message.guild.id);
    return message.reply({ embeds: [baseEmbed(COLORS.info).setTitle("🗓️ Scheduled posts (UTC)").setDescription(
      list.map((s) => `\`${s.id}\` • ${s.every}${s.day ? ` ${s.day}` : ""} ${s.time} → <#${s.channelId}> — ${s.kind === "sotw" ? "📸 Screenshot of the Week" : s.message.slice(0, 60)}`).join("\n") || "None.")], allowedMentions: { parse: [] } });
  }
  if (sub === "remove") return message.reply(removeSchedule(message.guild.id, args[1]) ? "✅ Removed." : "No schedule with that ID.");

  const every = sub === "sotw" ? "weekly" : sub;
  if (!["daily", "weekly", "monthly"].includes(every)) return message.reply(`Usage:\n${usage.split("  |  ").map((u) => `\`${u}\``).join("\n")}`);
  let i = 1;
  let day = null;
  if (every !== "daily") {
    day = (args[i++] || "").toLowerCase();
    if (every === "weekly" && !DAYS.includes(day.slice(0, 3))) return message.reply("Day must be mon, tue, wed, thu, fri, sat or sun.");
    if (every === "monthly" && !(+day >= 1 && +day <= 28)) return message.reply("Monthly day must be 1–28.");
    if (every === "weekly") day = day.slice(0, 3);
  }
  const time = args[i++];
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time || "")) return message.reply("Time must be HH:MM in UTC, e.g. `18:00`.");
  const channel = message.mentions.channels.first();
  if (!channel) return message.reply("Mention the channel to post in.");
  const role = message.mentions.roles.first();
  const text = args.slice(i).filter((a) => !/^<[#@]&?\d+>$/.test(a)).join(" ").trim();
  if (sub !== "sotw" && !text) return message.reply("Add the message to post.");
  const id = addSchedule(message.guild.id, { every, day, time, channelId: channel.id, message: text, ping: role?.id || null, kind: sub === "sotw" ? "sotw" : "post" });
  return message.reply(`✅ Scheduled \`${id}\`: ${every}${day ? ` ${day}` : ""} at ${time} UTC in ${channel}.`);
}
