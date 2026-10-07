import { baseEmbed, COLORS } from "../utils/embeds.js";
import { getOpenTicket, closeTicket } from "../../features/tickets.js";
import { isStaff } from "../../features/config.js";

export const name = "ticket";
export const description = "Manage the ticket you're in: close, add/remove a user, rename";
export const usage = "!ticket close [reason]  |  !ticket add @user  |  !ticket remove @user  |  !ticket rename <name>";
export const category = "mod";

export async function execute(message, args) {
  const tk = getOpenTicket(message.guild.id, message.channelId);
  if (!tk) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Run this inside a ticket channel.")] });
  const staff = isStaff(message.member);
  const sub = (args[0] || "").toLowerCase();
  const target = message.mentions.members.first();

  if (sub === "close") {
    if (!staff && message.author.id !== tk.ownerId) return message.reply("Only staff or the ticket owner can close it.");
    await message.channel.send({ embeds: [baseEmbed(COLORS.warning).setDescription(`🔒 Closing in 5 seconds… (by ${message.author})`)] });
    return closeTicket(message.channel, message.author, args.slice(1).join(" ") || null);
  }
  if (!staff) return message.reply("Only staff can do that.");
  if (sub === "add" && target) {
    await message.channel.permissionOverwrites.edit(target.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
    return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ Added ${target} to this ticket.`)] });
  }
  if (sub === "remove" && target) {
    if (target.id === tk.ownerId) return message.reply("You can't remove the ticket owner — close the ticket instead.");
    await message.channel.permissionOverwrites.delete(target.id).catch(() => {});
    return message.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`✅ Removed ${target} from this ticket.`)] });
  }
  if (sub === "rename" && args[1]) {
    await message.channel.setName(args.slice(1).join("-").toLowerCase().slice(0, 90));
    return message.react("✅").catch(() => {});
  }
  return message.reply(`Usage: \`${usage}\``);
}
