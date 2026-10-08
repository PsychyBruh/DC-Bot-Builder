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
    if (id === "tkta:add") return run(import("./tickets.js"), "handleTicketAddModal", interaction);
    if (id === "tktc:close") return run(import("./tickets.js"), "handleTicketCloseModal", interaction);
    if (id.startsWith("tkrd:")) return run(import("./tickets.js"), "handleReviewDenyModal", interaction);
    if (id.startsWith("sgd:")) return run(import("./forumSuggestions.js"), "handleDenyModal", interaction);
    if (id === "pnm:notes") return run(import("../commands/mod/patchnotes.js"), "handlePatchModal", interaction);
    if (id === "vfym:captcha") return run(import("./verification.js"), "handleCaptchaModal", interaction);
    return false;
  }

  if (!interaction.isButton?.()) return false;
  if (id.startsWith("sr:")) return run(import("./roles.js"), "handleSelfRoleButton", interaction);
  if (id === "verify") return run(import("./verification.js"), "handleVerifyButton", interaction);
  if (id === "vfy:code") return run(import("./verification.js"), "handleCodeButton", interaction);
  if (id === "vfy:roblox") return run(import("./verification.js"), "handleRobloxButton", interaction);
  if (id.startsWith("tkt:")) return run(import("./tickets.js"), "handleTicketButton", interaction);
  if (id.startsWith("tkr:")) return run(import("./tickets.js"), "handleReviewButton", interaction);
  if (id.startsWith("bp:")) return run(import("../commands/admin/blueprint.js"), "handleBlueprintButton", interaction);
  if (id.startsWith("fs:")) return run(import("./forumSuggestions.js"), "handleForumSuggestionButton", interaction);
  if (id.startsWith("bug:")) return run(import("./bugs.js"), "handleBugButton", interaction);
  if (id.startsWith("dup:")) return run(import("./clean.js"), "handleDuplicateButton", interaction);
  if (id.startsWith("wb:")) return run(import("./safety.js"), "handleWarnBanButton", interaction);
  if (id === "pn:open") return run(import("../commands/mod/patchnotes.js"), "handlePatchButton", interaction);
  if (id === "gw:reroll") return run(import("../commands/public/giveaway.js"), "handleRerollButton", interaction);
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
