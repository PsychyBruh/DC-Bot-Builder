import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export const name = "help";
export const description = "Show all commands (ephemeral)";
export const usage = "!help [category|command]";
export const category = "info";

const CATEGORIES = {
  fun: { emoji: "🎉", name: "Fun & Text Play", color: COLORS.pink },
  games: { emoji: "🎮", name: "Games", color: COLORS.gold },
  social: { emoji: "👥", name: "Social", color: COLORS.purple },
  leaderboard: { emoji: "🏆", name: "Leaderboards", color: COLORS.gold },
  economy: { emoji: "💰", name: "Economy", color: COLORS.gold },
  rooms: { emoji: "🔒", name: "Private Rooms", color: COLORS.info },
  utility: { emoji: "🔧", name: "Utility", color: COLORS.info },
  ai: { emoji: "🤖", name: "AI Commands", color: COLORS.purple },
  admin: { emoji: "⚙️", name: "Admin", color: COLORS.warning },
  info: { emoji: "❓", name: "Info", color: COLORS.info },
};

function getCommandsByCategory(client, category) {
  const out = [];
  for (const [name, cmd] of client.commands) {
    if ((cmd.category || "misc") === category) out.push(cmd);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function buildHelpEmbed(meta, cmds) {
  if (cmds.length === 0) {
    return baseEmbed(COLORS.warning).setDescription(`No commands in ${meta.name} yet.`);
  }
  const lines = cmds.map((c) => `\`!${c.name}\` — ${c.description}`);
  return baseEmbed(meta.color)
    .setTitle(`${meta.emoji} ${meta.name}`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `${cmds.length} command${cmds.length === 1 ? "" : "s"}` });
}

export async function execute(message, args, { client, isAdmin }) {
  const sub = args[0]?.toLowerCase();

  if (sub && CATEGORIES[sub]) {
    if (sub === "admin" && !isAdmin) {
      return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Admin only.")] });
    }
    const meta = CATEGORIES[sub];
    const cmds = getCommandsByCategory(client, sub);
    return message.reply({ embeds: [buildHelpEmbed(meta, cmds)], ephemeral: true });
  }

  if (sub && client.commands.has(sub)) {
    const cmd = client.commands.get(sub);
    if (cmd.adminOnly && !isAdmin) {
      return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Admin only.")] });
    }
    const embed = baseEmbed(COLORS.info)
      .setTitle(`❓ !${cmd.name}`)
      .setDescription(cmd.description || "No description")
      .addFields(
        { name: "Usage", value: cmd.usage || `!${cmd.name}`, inline: true },
        { name: "Category", value: cmd.category || "misc", inline: true },
        { name: "Admin only", value: cmd.adminOnly ? "Yes" : "No", inline: true },
      );
    return message.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Unknown: \`${sub}\``)], ephemeral: true });
  }

  const total = client.commands.size;
  const pub = client.publicCommands.size;
  const adm = client.adminCommands.size;
  const intro = baseEmbed(COLORS.primary)
    .setTitle(`${EMOJIS.sparkle} Project Nova — Help`)
    .setDescription(
      `Multi-purpose Discord bot by Project Nova: games, fun, social, AI, and admin tools.\n\n` +
      `**${total}** commands: **${pub}** public • **${adm}** admin\n\n` +
      `Click a category button below.\nType \`!help <command>\` for command details.\nType \`!help <category>\` to view a category.`,
    )
    .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: "Only you see this" });

  const rows = [];
  const entries = Object.entries(CATEGORIES).filter(([key]) => key !== "admin" || isAdmin);
  let row = new ActionRowBuilder();
  let count = 0;
  for (let i = 0; i < entries.length; i++) {
    const [key, cat] = entries[i];
    const style = key === "admin" ? ButtonStyle.Danger : key === "ai" ? ButtonStyle.Primary : ButtonStyle.Secondary;
    row.addComponents(new ButtonBuilder()
      .setCustomId(`help_${key}_${Date.now()}`)
      .setLabel(`${cat.emoji} ${cat.name}`)
      .setStyle(style),
    );
    count++;
    if (count === 5 || i === entries.length - 1) {
      rows.push(row);
      row = new ActionRowBuilder();
      count = 0;
    }
  }
  await message.reply({ embeds: [intro], components: rows, ephemeral: true });
}

export async function handleHelpButton(interaction, { client }) {
  if (!interaction.customId.startsWith("help_")) return false;
  const cat = interaction.customId.split("_")[1];
  if (!CATEGORIES[cat]) return false;
  if (cat === "admin") {
    const member = interaction.member;
    const isAdmin = member?.permissions?.has(8n);
    if (!isAdmin) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }
  }
  const meta = CATEGORIES[cat];
  const cmds = getCommandsByCategory(client, cat);
  await interaction.update({ embeds: [buildHelpEmbed(meta, cmds)], components: [], ephemeral: true });
  return true;
}
