import { baseEmbed, COLORS } from "../utils/embeds.js";
import { featureData, saveFeatures, canManageRole } from "../../features/config.js";
import { postLeaderboards, syncAllAchievements } from "../../features/roblox.js";
import { updateRobloxStatus } from "../../features/automation.js";

export const name = "roblox";
export const description = "Configure Roblox features: achievement roles, in-game leaderboards, status refresh";
export const usage = "!roblox achievement add <badgeId> @role  |  !roblox achievement remove <badgeId>  |  !roblox leaderboard add <OrderedDataStore> [asc] [time] <Title>  |  !roblox leaderboard remove <store>  |  !roblox leaderboard post  |  !roblox status  |  !roblox sync  |  !roblox list";
export const category = "admin";
export const adminOnly = true;

export async function execute(message, args) {
  const [area, action] = [(args[0] || "list").toLowerCase(), (args[1] || "").toLowerCase()];
  const ach = featureData(message.guild.id, "achievements", []);
  const lbs = featureData(message.guild.id, "leaderboards", []);

  if (area === "achievement") {
    if (action === "add") {
      const badgeId = args[2];
      const role = message.mentions.roles.first();
      if (!/^\d+$/.test(badgeId || "") || !role) return message.reply("Usage: `!roblox achievement add <badgeId> @role`");
      if (!canManageRole(message.guild, role)) return message.reply(`I can't give **${role.name}** — move my role above it.`);
      const i = ach.findIndex((a) => a.badgeId === badgeId);
      if (i >= 0) ach.splice(i, 1);
      ach.push({ badgeId, roleId: role.id });
      saveFeatures();
      return message.reply(`✅ Owning badge \`${badgeId}\` now gives ${role} to linked members (checked daily, or \`!link sync\`).`);
    }
    if (action === "remove") {
      const i = ach.findIndex((a) => a.badgeId === args[2]);
      if (i < 0) return message.reply("No achievement with that badge ID.");
      ach.splice(i, 1); saveFeatures();
      return message.reply("✅ Removed.");
    }
  }
  if (area === "leaderboard") {
    if (action === "add") {
      const store = args[2];
      const flags = args.slice(3);
      const ascending = flags.some((f) => /^asc/i.test(f));
      const format = flags.some((f) => /^time$/i.test(f)) ? "time" : "number";
      const title = flags.filter((f) => !/^(asc|ascending|desc|time)$/i.test(f)).join(" ") || store;
      if (!store) return message.reply("Usage: `!roblox leaderboard add <OrderedDataStore name> [asc] [time] <Title>` — use `asc time` for fastest-time records.");
      lbs.push({ store, title, ascending, format });
      saveFeatures();
      return message.reply(`✅ Added leaderboard **${title}** (${store}, ${ascending ? "lowest first" : "highest first"}${format === "time" ? ", times in ms" : ""}). Posts daily.`);
    }
    if (action === "remove") {
      const i = lbs.findIndex((l) => l.store === args[2]);
      if (i < 0) return message.reply("No leaderboard for that store.");
      lbs.splice(i, 1); saveFeatures();
      return message.reply("✅ Removed.");
    }
    if (action === "post") {
      const res = await postLeaderboards(message.guild);
      return message.reply(res.error ? `❌ ${res.error}` : "✅ Posted.");
    }
  }
  if (area === "status") { await updateRobloxStatus(message.guild); return message.reply("✅ Status refreshed (needs `roblox_universe_id`)."); }
  if (area === "sync") { await syncAllAchievements(message.client); return message.reply("✅ Achievement roles synced."); }
  return message.reply({ embeds: [baseEmbed(COLORS.info).setTitle("🎮 Roblox config")
    .addFields(
      { name: "Achievement roles", value: ach.map((a) => `Badge \`${a.badgeId}\` → <@&${a.roleId}>`).join("\n") || "None" },
      { name: "Leaderboards", value: lbs.map((l) => `**${l.title}** — \`${l.store}\`${l.ascending ? " (asc)" : ""}${l.format === "time" ? " ⏱️" : ""}`).join("\n") || "None" },
    ).setFooter({ text: "Universe ID: !setup roblox_universe_id <id> • Open Cloud key: ROBLOX_API_KEY in .env" })], allowedMentions: { parse: [] } });
}
