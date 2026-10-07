import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { startLink, finishLink, getLink, unlink, applyLinkRoles } from "../../features/roblox.js";

export const name = "link";
export const description = "Link your Roblox account (verified with a code in your profile)";
export const usage = "!link <roblox username>  |  !link verify  |  !link status  |  !link remove  |  !link sync";
export const category = "social";

export async function execute(message, args) {
  if (!(await applyCooldown(message, "link", "economy"))) return;
  const sub = (args[0] || "").toLowerCase();
  try {
    if (!sub || sub === "status") {
      const l = getLink(message.author.id);
      return message.reply(l ? `🔗 Linked to **${l.username}** (https://www.roblox.com/users/${l.robloxId}/profile)` : "You're not linked. Use `!link <roblox username>`.");
    }
    if (sub === "remove" || sub === "unlink") return message.reply(unlink(message.author.id) ? "Unlinked." : "You weren't linked.");
    if (sub === "sync") {
      const gained = await applyLinkRoles(message.member);
      return message.reply(gained.length ? `✅ Gave you: ${gained.join(", ")}` : "Your roles are already up to date.");
    }
    if (sub === "verify" || sub === "done") {
      const res = await finishLink(message.member);
      if (res.error) return message.reply(`❌ ${res.error}`);
      return message.reply({ embeds: [baseEmbed(COLORS.success).setTitle("🔗 Roblox linked!").setDescription(`You're linked to **${res.username}**. You can remove the code from your profile now.`)] });
    }
    const res = await startLink(message.author.id, args[0]);
    if (res.error) return message.reply(`❌ ${res.error}`);
    return message.reply({ embeds: [baseEmbed(COLORS.info).setTitle("🔗 Link your Roblox account").setDescription(
      `1. Go to your Roblox profile (**${res.username}**) and put this in your **About**:\n\`\`\`${res.code}\`\`\`\n2. Save it, then run \`!link verify\` within 30 minutes.`)] });
  } catch (err) {
    return message.reply(`❌ Roblox didn't respond (${err.message}). Try again in a minute.`);
  }
}
