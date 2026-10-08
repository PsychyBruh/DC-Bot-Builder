import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } from "discord.js";
import { baseEmbed, COLORS } from "../utils/embeds.js";
import { memberAllowed, resolveChannel, resolveRole } from "../../features/config.js";
import { setSetting } from "../../storage/serverSettings.js";

export const name = "patchnotes";
export const description = "Open a form to post formatted patch notes (pings the update role)";
export const usage = "!patchnotes";
export const category = "mod";

export async function execute(message) {
  if (!memberAllowed(message.member, "patch_roles", null)) return message.reply("You can't post patch notes.");
  // Modals need an interaction, so hand the user a button that opens the form
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("pn:open").setLabel("Write patch notes").setStyle(ButtonStyle.Secondary));
  return message.reply({ content: "Click to open the patch notes form:", components: [row] });
}

export async function handlePatchButton(interaction) {
  if (!memberAllowed(interaction.member, "patch_roles", null)) return interaction.reply({ content: "You can't post patch notes.", ephemeral: true });
  const field = (id, label, style, required = false) => new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(style === TextInputStyle.Short ? 100 : 1000));
  const modal = new ModalBuilder().setCustomId("pnm:notes").setTitle("Patch notes").addComponents(
    field("head", "Version — Title (e.g. v1.4 — Frost Update)", TextInputStyle.Short, true),
    field("added", "Added", TextInputStyle.Paragraph),
    field("changed", "Changed", TextInputStyle.Paragraph),
    field("fixed", "Fixed", TextInputStyle.Paragraph),
    field("known", "Known issues", TextInputStyle.Paragraph),
  );
  return interaction.showModal(modal);
}

const bullets = (t) => t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => (/^[-•*]/.test(l) ? `• ${l.replace(/^[-•*]\s*/, "")}` : `• ${l}`)).join("\n");

export async function handlePatchModal(interaction) {
  const head = interaction.fields.getTextInputValue("head");
  const parts = [["Added", "added"], ["Changed", "changed"], ["Fixed", "fixed"], ["Known issues", "known"]]
    .map(([label, id]) => [label, interaction.fields.getTextInputValue(id)?.trim()]).filter(([, v]) => v);
  const guild = interaction.guild;
  const full = resolveChannel(guild, "patch_notes_channel", ["patch-notes", "patchnotes", "updates"]);
  const short = resolveChannel(guild, "announcements_channel", ["announcements"]);
  const ping = resolveRole(guild, "update_ping_role", ["update ping", "updates ping"]);
  if (!full) return interaction.reply({ content: "No patch notes channel — set `patch_notes_channel`.", ephemeral: true });
  const embed = baseEmbed(COLORS.dark).setTitle(`📝 ${head}`.slice(0, 256))
    .addFields(parts.map(([label, v]) => ({ name: label, value: bullets(v).slice(0, 1024) })))
    .setFooter({ text: `Posted by ${interaction.user.username}` });
  const msg = await full.send({ content: ping ? `${ping}` : undefined, embeds: [embed], allowedMentions: { roles: ping ? [ping.id] : [] } });
  if (full.type === ChannelType.GuildAnnouncement) await msg.crosspost().catch(() => {});
  if (short && short.id !== full.id) {
    const counts = parts.map(([label, v]) => `${v.split("\n").filter((l) => l.trim()).length} ${label.toLowerCase()}`).join(" · ");
    await short.send({ embeds: [baseEmbed(COLORS.dark).setTitle(`🛠️ ${head}`.slice(0, 256)).setDescription(`${counts}\n\nFull notes: ${msg.url}`)] }).catch(() => {});
  }
  const version = head.match(/v?\d+(\.\d+)+/i)?.[0];
  if (version) setSetting(guild.id, "current_version", version);
  return interaction.reply({ content: `✅ Posted: ${msg.url}`, ephemeral: true });
}
