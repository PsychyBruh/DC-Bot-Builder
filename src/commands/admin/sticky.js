import { baseEmbed, COLORS } from "../utils/embeds.js";
import { setSticky, removeSticky, listStickies, postStickyNow } from "../../features/sticky.js";

export const name = "sticky";
export const description = "Keep a note pinned to the bottom of a channel";
export const usage = "!sticky set [#channel] <text>  |  !sticky remove [#channel]  |  !sticky list";
export const category = "admin";
export const adminOnly = true;

export async function execute(message, args) {
  const sub = (args[0] || "list").toLowerCase();
  const ch = message.mentions.channels.first() || message.channel;
  if (sub === "set") {
    const text = args.slice(1).filter((a) => !/^<#\d+>$/.test(a)).join(" ").trim();
    if (!text) return message.reply(`Usage: \`${usage}\``);
    setSticky(message.guild.id, ch.id, text.slice(0, 3000));
    await postStickyNow(ch);
    return message.reply(`📌 Sticky set in ${ch}.`);
  }
  if (sub === "remove") return message.reply(removeSticky(message.guild.id, ch.id) ? `Removed the sticky from ${ch}.` : "No sticky there.");
  const all = Object.entries(listStickies(message.guild.id));
  return message.reply({ embeds: [baseEmbed(COLORS.info).setTitle("📌 Sticky messages").setDescription(all.map(([c, s]) => `<#${c}> — ${s.text.slice(0, 80)}`).join("\n") || "None.")] });
}
