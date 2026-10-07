import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { baseEmbed, COLORS } from "../commands/utils/embeds.js";
import { featureData, saveFeatures, resolveChannel, resolveRole, isStaff, canManageRole } from "./config.js";

// Up to 5 questions each (Discord's modal limit). Roles granted on accept come from
// settings app_role_<type>, else a role with the default name if it exists.
export const APP_TYPES = {
  staff: {
    label: "Staff", emoji: "🛡️", roleDefaults: ["trial mod", "trial moderator", "helper"],
    questions: [
      ["age", "How old are you?", TextInputStyle.Short],
      ["timezone", "Timezone & weekly hours you can give", TextInputStyle.Short],
      ["experience", "Previous moderation experience", TextInputStyle.Paragraph],
      ["why", "Why do you want to join the staff team?", TextInputStyle.Paragraph],
      ["scenario", "Two members are fighting in chat. What do you do?", TextInputStyle.Paragraph],
    ],
  },
  tester: {
    label: "Tester", emoji: "🧪", roleDefaults: ["tester", "testers", "beta tester"],
    questions: [
      ["roblox", "Roblox username", TextInputStyle.Short],
      ["device", "Device(s) you play on", TextInputStyle.Short],
      ["hours", "How many hours a week can you test?", TextInputStyle.Short],
      ["bugs", "Describe a bug you found in a game & how you'd report it", TextInputStyle.Paragraph],
      ["why", "Why do you want to be a tester?", TextInputStyle.Paragraph],
    ],
  },
  creator: {
    label: "Content Creator", emoji: "🎥", roleDefaults: ["content creator", "creator"],
    questions: [
      ["channel", "Link to your channel(s)", TextInputStyle.Short],
      ["followers", "Follower / subscriber count", TextInputStyle.Short],
      ["content", "What content do you make?", TextInputStyle.Paragraph],
      ["plan", "What would you make about our game?", TextInputStyle.Paragraph],
    ],
  },
  partner: {
    label: "Partner", emoji: "🤝", roleDefaults: ["partner", "partners"],
    questions: [
      ["link", "Server / community invite link", TextInputStyle.Short],
      ["members", "Member count", TextInputStyle.Short],
      ["about", "What is your community about?", TextInputStyle.Paragraph],
      ["offer", "What does the partnership look like?", TextInputStyle.Paragraph],
    ],
  },
};

// A server can define its own forms (featureData appConfig.types):
// { key: { label, emoji, roleDefaults?: [names], questions: [[id, label, "short"|"paragraph"], ...] } }
export function getAppTypes(guildId) {
  const custom = featureData(guildId, "appConfig", {}).types;
  if (!custom || !Object.keys(custom).length) return APP_TYPES;
  const out = {};
  for (const [k, a] of Object.entries(custom)) {
    out[k] = { ...a, roleDefaults: a.roleDefaults || [], questions: (a.questions || []).slice(0, 5).map(([id, label, style]) => [id, label, style === "short" || style === TextInputStyle.Short ? TextInputStyle.Short : TextInputStyle.Paragraph]) };
  }
  return out;
}

function reviewChannel(guild) {
  return resolveChannel(guild, "application_channel", ["applications", "app-review", "application-review", "staff-applications"]);
}

export async function postApplicationPanel(channel) {
  const types = getAppTypes(channel.guild.id);
  const embed = baseEmbed(COLORS.primary)
    .setTitle("📝 Applications")
    .setDescription("Want to help out? Pick what you're applying for below. A short form will pop up.\n\n" +
      Object.values(types).map((a) => `${a.emoji || "📝"} **${a.label}**`).join("\n"));
  embed.data.timestamp = undefined;
  const buttons = Object.entries(types).slice(0, 25).map(([type, a]) =>
    new ButtonBuilder().setCustomId(`app:${type}`).setLabel(a.label.slice(0, 80)).setEmoji(a.emoji || "📝").setStyle(ButtonStyle.Secondary));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  return channel.send({ embeds: [embed], components: rows });
}

export async function handleApplyButton(interaction) {
  const type = interaction.customId.split(":")[1];
  const a = getAppTypes(interaction.guildId)[type];
  if (!a) return interaction.reply({ content: "Unknown application.", ephemeral: true });
  const apps = featureData(interaction.guildId, "applications", {});
  const pending = Object.values(apps).find((x) => x.userId === interaction.user.id && x.type === type && x.status === "pending");
  if (pending) return interaction.reply({ content: `You already have a pending ${a.label} application. Please wait for a decision.`, ephemeral: true });
  const recent = Object.values(apps).find((x) => x.userId === interaction.user.id && x.type === type && x.status === "denied" && Date.now() - x.decidedAt < 14 * 86400000);
  if (recent) return interaction.reply({ content: `Your last ${a.label} application was denied. You can re-apply <t:${Math.floor((recent.decidedAt + 14 * 86400000) / 1000)}:R>.`, ephemeral: true });
  const modal = new ModalBuilder().setCustomId(`appm:${type}`).setTitle(`${a.label} Application`.slice(0, 45));
  for (const [id, label, style] of a.questions) {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(id).setLabel(label.slice(0, 45)).setStyle(style).setRequired(true)
        .setMaxLength(style === TextInputStyle.Short ? 200 : 1000),
    ));
  }
  return interaction.showModal(modal);
}

export async function handleApplicationModal(interaction) {
  const type = interaction.customId.split(":")[1];
  const a = getAppTypes(interaction.guildId)[type];
  const channel = reviewChannel(interaction.guild);
  if (!channel) return interaction.reply({ content: "Applications aren't set up yet (no review channel). Please tell an admin.", ephemeral: true });
  const embed = baseEmbed(COLORS.info)
    .setTitle(`${a.emoji} ${a.label} application`)
    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
    .setDescription(`**Applicant:** ${interaction.user}\n**Account created:** <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>\n**Joined server:** ${interaction.member.joinedTimestamp ? `<t:${Math.floor(interaction.member.joinedTimestamp / 1000)}:R>` : "?"}`)
    .addFields(a.questions.map(([id, label]) => ({ name: label, value: interaction.fields.getTextInputValue(id) || "—" })))
    .setFooter({ text: "Status: pending" });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("appr:accept").setLabel("Accept").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("appr:deny").setLabel("Deny").setEmoji("❌").setStyle(ButtonStyle.Danger),
  );
  const msg = await channel.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
  const apps = featureData(interaction.guildId, "applications", {});
  apps[msg.id] = { userId: interaction.user.id, type, status: "pending", submittedAt: Date.now() };
  saveFeatures();
  return interaction.reply({ content: `✅ Your ${a.label} application was submitted! You'll get a DM when staff decide.`, ephemeral: true });
}

export async function handleReviewButton(interaction) {
  if (!isStaff(interaction.member)) return interaction.reply({ content: "Only staff can review applications.", ephemeral: true });
  const app = featureData(interaction.guildId, "applications", {})[interaction.message.id];
  if (!app || app.status !== "pending") return interaction.reply({ content: "This application was already handled.", ephemeral: true });
  const action = interaction.customId.split(":")[1];
  // Ask for a reason via a small modal, then finish in handleReviewModal
  const modal = new ModalBuilder().setCustomId(`appd:${action}:${interaction.message.id}`).setTitle(action === "accept" ? "Accept application" : "Deny application")
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("note").setLabel("Message to the applicant (optional)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(800),
    ));
  return interaction.showModal(modal);
}

export async function handleReviewModal(interaction) {
  const [, action, messageId] = interaction.customId.split(":");
  const apps = featureData(interaction.guildId, "applications", {});
  const app = apps[messageId];
  if (!app || app.status !== "pending") return interaction.reply({ content: "Already handled.", ephemeral: true });
  const note = interaction.fields.getTextInputValue("note");
  const a = getAppTypes(interaction.guildId)[app.type] || { label: app.type, emoji: "📝", roleDefaults: [] };
  app.status = action === "accept" ? "accepted" : "denied";
  app.decidedAt = Date.now();
  app.reviewer = interaction.user.id;
  saveFeatures();

  let roleLine = "";
  if (action === "accept") {
    const role = resolveRole(interaction.guild, `app_role_${app.type}`, a.roleDefaults);
    const member = await interaction.guild.members.fetch(app.userId).catch(() => null);
    if (role && member && canManageRole(interaction.guild, role)) {
      await member.roles.add(role, `${a.label} application accepted`).catch(() => {});
      roleLine = `\nGave role **${role.name}**.`;
    }
  }
  const msg = await interaction.channel.messages.fetch(messageId).catch(() => null);
  if (msg) {
    const embed = baseEmbed(action === "accept" ? COLORS.success : COLORS.danger);
    embed.data = { ...msg.embeds[0].data, color: action === "accept" ? COLORS.success : COLORS.danger, footer: { text: `${action === "accept" ? "Accepted" : "Denied"} by ${interaction.user.tag}${note ? ` — ${note}`.slice(0, 1800) : ""}` } };
    await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
  }
  const user = await interaction.client.users.fetch(app.userId).catch(() => null);
  if (user) {
    await user.send({ embeds: [baseEmbed(action === "accept" ? COLORS.success : COLORS.danger)
      .setTitle(`${a.emoji} ${a.label} application ${action === "accept" ? "accepted 🎉" : "denied"}`)
      .setDescription(`Your application in **${interaction.guild.name}** was ${action === "accept" ? "accepted" : "denied"}.${note ? `\n\n>>> ${note}` : ""}`)] }).catch(() => {});
  }
  return interaction.reply({ content: `${action === "accept" ? "✅ Accepted" : "❌ Denied"} <@${app.userId}>'s application.${roleLine}`, ephemeral: true });
}
