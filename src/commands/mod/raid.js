import { baseEmbed, COLORS } from "../utils/embeds.js";
import { startLockdown, endLockdown, raidState } from "../../features/safety.js";
import { isStaff } from "../../features/config.js";

export const name = "raid";
export const description = "Turn raid lockdown on/off manually, or check its status";
export const usage = "!raid on|off|status";
export const category = "mod";

export async function execute(message, args) {
  if (!isStaff(message.member)) return message.reply("Staff only.");
  const sub = (args[0] || "status").toLowerCase();
  if (sub === "on") {
    const ok = await startLockdown(message.guild, "manual", message.author);
    return message.reply(ok ? "🚨 Lockdown on." : "Already in lockdown.");
  }
  if (sub === "off") {
    const ok = await endLockdown(message.guild, message.author);
    return message.reply(ok ? "🔓 Lockdown lifted." : "Not in lockdown.");
  }
  const s = raidState(message.guild.id);
  return message.reply({ embeds: [baseEmbed(s.locked ? COLORS.danger : COLORS.success).setDescription(
    s.locked ? `🚨 Lockdown active — auto-unlocks <t:${Math.floor(s.until / 1000)}:R>.` : "✅ No lockdown active.")] });
}
