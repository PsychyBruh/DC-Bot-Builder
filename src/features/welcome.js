import { AttachmentBuilder } from "discord.js";
import { getSettings } from "../storage/serverSettings.js";
import { resolveChannel } from "./config.js";

// Welcome message + image card. Posted on join, or on verify when welcome_on = "verify".
export async function postWelcome(member) {
  const guild = member.guild;
  const settings = getSettings(guild.id);
  const channel = resolveChannel(guild, "welcome_channel", ["welcome", "welcomes", "arrivals"]);
  if (!channel || settings.welcome_enabled === "false") return;
  const text = (settings.welcome_message || "Welcome {user} to **{server}**!")
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{server}/g, guild.name)
    .replace(/{count}/g, String(guild.memberCount))
    .replace(/@(everyone|here)/g, "@​$1");
  const payload = { content: text, allowedMentions: { users: [member.id] } };
  if (settings.welcome_card !== "false") {
    try {
      const { renderWelcomeCard } = await import("./welcomeCard.js");
      payload.files = [new AttachmentBuilder(await renderWelcomeCard(member), { name: "welcome.png" })];
    } catch (err) {
      console.error("welcome card failed:", err.message);
    }
  }
  await channel.send(payload).catch(() => {});
}

export async function sendWelcomeDm(member) {
  const tpl = getSettings(member.guild.id).welcome_dm;
  if (!tpl) return;
  const text = tpl.replace(/{user}/g, member.displayName).replace(/{server}/g, member.guild.name);
  await member.send(text.slice(0, 1900)).catch(() => {});
}
