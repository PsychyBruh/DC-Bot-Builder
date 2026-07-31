import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { adjustBalance, getUser } from "../../storage/users.js";

export const name = "giveaway";
export const description = "Host a coin giveaway (creator funds the pot)";
export const usage = "!giveaway <amount> <winners> <duration>";
export const category = "economy";

function parseDuration(s) {
  if (typeof s !== "string") return null;
  const m = /^(\d+)(s|m|h|d)$/i.exec(s.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n * { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2].toLowerCase()];
}

export async function execute(message, args) {
  if (!(await applyCooldown(message, "giveaway", "economy"))) return;
  const amount = parseInt(args[0], 10);
  const winners = parseInt(args[1], 10);
  const dur = parseDuration(args[2]);
  if (!amount || amount < 1 || !winners || winners < 1 || !dur || dur < 10000) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Usage: `!giveaway <amount> <winners> <duration>`\nExample: `!giveaway 100 1 1h` (duration: `30s`, `5m`, `2h`, or `1d`; minimum 10s)")] });
  }
  const totalCost = amount * winners;
  const user = getUser(message.author.id);
  if ((user.balance || 0) < totalCost) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Need ${totalCost} coins. You have ${user.balance || 0}.`)] });
  }
  adjustBalance(message.author.id, -totalCost);
  const endsAt = Date.now() + dur;
  const embed = baseEmbed(COLORS.gold)
    .setTitle("🎉 GIVEAWAY")
    .setDescription(`**${message.author.username}** is giving away **${amount} coins** × **${winners}** winners!\n\nReact with 🎉 to enter.\nEnds <t:${Math.floor(endsAt / 1000)}:R>`)
    .setFooter({ text: `Pot: ${totalCost} coins` });
  const m = await message.reply({ embeds: [embed] });
  await m.react("🎉");
  setTimeout(async () => {
    try {
      const fetched = await m.fetch();
      const entries = [...fetched.reactions.cache.get("🎉")?.users.cache.keys() || []].filter((id) => id !== message.client.user.id);
      if (!entries.length) {
        const e = baseEmbed(COLORS.warning).setTitle("🎉 Giveaway Ended").setDescription("No entries.");
        return m.edit({ embeds: [e] });
      }
      const winnersList = [];
      const pool = [...entries];
      for (let i = 0; i < winners && pool.length; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        winnersList.push(pool[idx]);
        pool.splice(idx, 1);
      }
      winnersList.forEach((id) => adjustBalance(id, amount));
      const e = baseEmbed(COLORS.gold)
        .setTitle("🎉 Giveaway Ended")
        .setDescription(`Winners: ${winnersList.map((id) => `<@${id}>`).join(", ")}\nEach won **${amount} coins**!`);
      await m.edit({ embeds: [e] });
    } catch {}
  }, dur);
}
