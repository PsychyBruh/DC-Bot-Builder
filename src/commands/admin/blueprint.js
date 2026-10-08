import { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from "discord.js";
import { baseEmbed, COLORS } from "../utils/embeds.js";
import { generateBlueprint, saveBlueprint, loadBlueprint, blueprintFile, summarize, buildBlueprint } from "../../features/blueprint.js";
import { readTextAttachments } from "../../services/attachments.js";
import { featureData } from "../../features/config.js";

export const name = "blueprint";
export const description = "Turn a full server spec into a build plan (1 AI call), review it, then build it without AI";
export const usage = "!blueprint <spec or attach .txt/.md>  |  !blueprint build  |  !blueprint show  |  !blueprint load (attach .json)  |  !blueprint status";
export const category = "admin";
export const adminOnly = true;

const running = new Set(); // guildIds currently building

function buttons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("bp:build").setLabel("Build it").setEmoji("🏗️").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("bp:cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
  );
}

async function showPlan(channel, guildId, bp, extra = "") {
  const file = new AttachmentBuilder(blueprintFile(guildId), { name: "blueprint.json" });
  return channel.send({
    embeds: [baseEmbed(COLORS.primary).setTitle("🧱 Server blueprint ready").setDescription(
      `${bp.summary ? `*${bp.summary}*\n\n` : ""}${summarize(bp)}\n\n${extra}` +
      "Review `blueprint.json` (you can edit it and re-upload with `!blueprint load`), then press **Build it**.\n\n" +
      "⚠️ Before building: drag my role to the **top** of the role list so I can create and order every role. Afterwards move it under the role you want.")],
    files: [file],
    components: [buttons()],
  });
}

export async function startBuild(guild, channel, user) {
  if (running.has(guild.id)) return channel.send("A build is already running.");
  const bp = loadBlueprint(guild.id);
  if (!bp) return channel.send("No blueprint saved — run `!blueprint <spec>` first.");
  running.add(guild.id);
  const status = await channel.send({ embeds: [baseEmbed(COLORS.info).setTitle("🏗️ Building…").setDescription("Starting")] });
  const started = Date.now();
  try {
    const { warnings } = await buildBlueprint(guild, bp, async (label) => {
      await status.edit({ embeds: [baseEmbed(COLORS.info).setTitle("🏗️ Building…").setDescription(`${label}\n\nElapsed: ${Math.round((Date.now() - started) / 1000)}s`)] }).catch(() => {});
    });
    const w = warnings.length ? `\n\n**${warnings.length} note(s):**\n${warnings.slice(0, 25).map((x) => `• ${x}`).join("\n")}${warnings.length > 25 ? `\n…and ${warnings.length - 25} more (\`!blueprint status\`)` : ""}` : "";
    await status.edit({ embeds: [baseEmbed(warnings.length ? COLORS.warning : COLORS.success).setTitle("✅ Build finished")
      .setDescription(`Done in ${Math.round((Date.now() - started) / 1000)}s.${w}\n\nRun \`!blueprint build\` again any time — it updates what exists and skips what's already posted.`)] });
  } catch (err) {
    console.error("blueprint build failed:", err);
    await status.edit({ embeds: [baseEmbed(COLORS.danger).setTitle("❌ Build stopped").setDescription(`${err.message}\n\nFix the issue and run \`!blueprint build\` — finished parts are skipped.`)] }).catch(() => {});
  } finally {
    running.delete(guild.id);
  }
}

export async function execute(message, args) {
  const sub = (args[0] || "").toLowerCase();
  if (sub === "build" || sub === "resume") return startBuild(message.guild, message.channel, message.author);
  if (sub === "show") {
    const bp = loadBlueprint(message.guild.id);
    if (!bp) return message.reply("No blueprint saved yet.");
    return showPlan(message.channel, message.guild.id, bp);
  }
  if (sub === "status") {
    const st = featureData(message.guild.id, "blueprint", {});
    return message.reply({ embeds: [baseEmbed(COLORS.info).setTitle("🧱 Blueprint status").setDescription(
      `${st.lastRun ? `Last build <t:${Math.floor(st.lastRun / 1000)}:R>` : "Not built yet"} · ${Object.keys(st.done || {}).length} posted items\n\n${(st.log || []).slice(0, 40).map((x) => `• ${x}`).join("\n") || "No notes."}`)] });
  }
  if (sub === "load") {
    const att = [...message.attachments.values()].find((a) => /\.json$/i.test(a.name));
    if (!att) return message.reply("Attach the edited `blueprint.json`.");
    try {
      const bp = await fetch(att.url).then((r) => r.json());
      saveBlueprint(message.guild.id, bp);
      return showPlan(message.channel, message.guild.id, bp, "Loaded from your file.\n\n");
    } catch (err) { return message.reply(`❌ Couldn't read that JSON: ${err.message}`); }
  }

  // Generate from text (+ attached .txt/.md)
  const files = await readTextAttachments(message);
  const spec = [args.join(" "), files.text].filter(Boolean).join("\n\n").trim();
  if (spec.length < 50) return message.reply(`Paste the full server spec after \`!blueprint\` or attach it as a .txt/.md file.\n\nOther options: \`${usage}\``);
  const status = await message.reply("🧠 Writing the build plan… (one AI call, can take a few minutes for a big server)");
  try {
    const bp = await generateBlueprint(spec);
    saveBlueprint(message.guild.id, bp);
    const { getUsage } = await import("../../services/ai.js");
    const u = await getUsage();
    await status.edit(`✅ Plan written. Total AI spend so far ≈ $${u.usd.toFixed(3)}.`);
    return showPlan(message.channel, message.guild.id, bp);
  } catch (err) {
    return status.edit(`❌ ${err.message}`);
  }
}

export async function handleBlueprintButton(interaction) {
  if (!interaction.memberPermissions?.has("Administrator")) return interaction.reply({ content: "Admins only.", ephemeral: true });
  if (interaction.customId === "bp:cancel") return interaction.update({ components: [] });
  await interaction.update({ components: [] });
  return startBuild(interaction.guild, interaction.channel, interaction.user);
}
