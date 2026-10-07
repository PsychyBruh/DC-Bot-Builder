// Routes buttons, select menus and modals for the server features. Returns true if handled.
export async function routeFeatureInteraction(interaction) {
  const id = interaction.customId || "";

  if (interaction.isStringSelectMenu?.()) {
    if (id === "srsel") return run(import("./roles.js"), "handleSelfRoleSelect", interaction);
    if (id === "tkt:open") return run(import("./tickets.js"), "handleTicketSelect", interaction);
    return false;
  }

  if (interaction.isModalSubmit?.()) {
    if (id.startsWith("tktm:")) return run(import("./tickets.js"), "handleTicketModal", interaction);
    if (id.startsWith("appm:")) return run(import("./applications.js"), "handleApplicationModal", interaction);
    if (id.startsWith("appd:")) return run(import("./applications.js"), "handleReviewModal", interaction);
    return false;
  }

  if (!interaction.isButton?.()) return false;
  if (id.startsWith("sr:")) return run(import("./roles.js"), "handleSelfRoleButton", interaction);
  if (id === "verify") return run(import("./roles.js"), "handleVerifyButton", interaction);
  if (id.startsWith("tkt:")) return run(import("./tickets.js"), "handleTicketButton", interaction);
  if (id.startsWith("app:")) return run(import("./applications.js"), "handleApplyButton", interaction);
  if (id.startsWith("appr:")) return run(import("./applications.js"), "handleReviewButton", interaction);
  if (id.startsWith("sg:")) return run(import("./voting.js"), "handleSuggestionVote", interaction);
  if (id.startsWith("poll:")) return run(import("./voting.js"), "handlePollVote", interaction);
  if (id === "gw:enter") return run(import("../commands/public/giveaway.js"), "handleGiveawayButton", interaction);
  if (id === "raid:unlock") return run(import("./safety.js"), "handleRaidButton", interaction);
  if (id.startsWith("alt:")) return run(import("./safety.js"), "handleAltButton", interaction);
  if (id.startsWith("pt:")) return run(import("./roblox.js"), "handlePlaytestButton", interaction);
  return false;
}

async function run(modPromise, fn, interaction) {
  if (!interaction.guild) {
    await interaction.reply({ content: "This only works in a server.", ephemeral: true }).catch(() => {});
    return true;
  }
  const mod = await modPromise;
  await mod[fn](interaction);
  return true;
}
