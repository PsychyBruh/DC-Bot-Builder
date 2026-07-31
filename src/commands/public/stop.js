import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "stop";
export const description = "Stop any active game session tracking your messages (or forfeit an active duel)";
export const usage = "!stop";
export const category = "games";

export async function execute(message) {
  const { channelId, author, channel } = message;
  const stopped = [];

  const modules = [
    { path: "./wordle.js", label: "Wordle" },
    { path: "./word-chain.js", label: "Word Chain" },
    { path: "./guess.js", label: "Number Guess" },
    { path: "./2048.js", label: "2048" },
    { path: "./minesweeper.js", label: "Minesweeper" },
    { path: "./duel.js", label: "Duel (you forfeit)" },
  ];

  for (const m of modules) {
    try {
      const mod = await import(m.path);
      if (typeof mod.stopSession === "function") {
        const result = mod.stopSession.length >= 3
          ? await mod.stopSession(channelId, author.id, channel)
          : await mod.stopSession(channelId, author.id);
        if (result) stopped.push(m.label);
      }
    } catch (e) {
      // ignore
    }
  }

  if (stopped.length) {
    const embed = baseEmbed(COLORS.success)
      .setTitle("\u{1F6D1} Sessions stopped")
      .setDescription(`Stopped tracking your messages for:\n${stopped.map((s) => `\u2022 **${s}**`).join("\n")}`)
      .setFooter({ text: "Note: stopping a duel costs you the wager (you forfeit)" });
    await message.reply({ embeds: [embed] });
  } else {
    const embed = baseEmbed(COLORS.info)
      .setTitle("\u{1F6D1} No active sessions")
      .setDescription("I'm not tracking any of your messages in this channel.")
      .setFooter({ text: "Wordle, Word Chain, Number Guess, 2048, Minesweeper, Duel" });
    await message.reply({ embeds: [embed] });
  }
}
