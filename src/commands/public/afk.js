import { baseEmbed, COLORS } from "../utils/embeds.js";
import { setAfk, clearAfk, getAfk } from "../../storage/users.js";

export const name = "afk";
export const description = "Set/remove AFK status";
export const usage = "!afk [reason]";
export const category = "social";

export async function execute(message, args) {
  const reason = args.join(" ");
  const current = getAfk(message.author.id);
  if (!reason) {
    if (current) {
      clearAfk(message.author.id);
      return message.reply({ embeds: [baseEmbed(COLORS.success).setTitle("👋 Welcome back!").setDescription("AFK status removed")] });
    }
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide a reason: `!afk <reason>`")] });
  }
  setAfk(message.author.id, reason);
  await message.reply({ embeds: [baseEmbed(COLORS.info).setTitle("💤 AFK Set").setDescription(`Reason: ${reason}`)] });
}
