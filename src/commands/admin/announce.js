import { postUpdate } from "../../features/automation.js";

export const name = "announce";
export const description = "Post patch notes as a formatted update embed and ping the update role";
export const usage = "!announce <title on the first line>\\n<patch notes…>  (attach an image to include it)";
export const category = "admin";
export const adminOnly = true;

export async function execute(message) {
  const raw = message.content.replace(/^!announce\s*/i, "").trim();
  if (!raw) return message.reply("Write the notes after `!announce` — first line is the title, the rest is the body. Bullets with `-` are fine.");
  const img = [...message.attachments.values()].find((a) => /^image\//.test(a.contentType || ""))?.url;
  const ok = await postUpdate(message.guild, raw, message.author.username, img);
  return message.reply(ok ? "📢 Posted." : "❌ No updates channel found — set `updates_channel`.");
}
