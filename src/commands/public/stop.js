import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "stop";
export const description = "Stop any active game session tracking your messages in this channel";
export const usage = "!stop";
export const category = "games";

export async function execute(message) {
  const { channelId, author } = message;
  const stopped = [];

  const modules = [
    { path: "./wordle.js", label: "Wordle" },
    { path: "./word-chain.js", label: "Word Chain" },
    { path: "./guess.js", label: "Number Guess" },
    { path: "./2048.js", label: "2048" },
    { path: "./minesweeper.js", label: "Minesweeper" },
  ];

  for (const m of modules) {
    try {
      const mod = await import(m.path);
      if (typeof mod.stopSession === "function") {
        const cleared = mod.stopSession(channelId, author.id);
        if (cleared) stopped.push(m.label);
      }
    } catch {}
  }

  if (stopped.length) {
    const embed = baseEmbed(COLORS.success)
      .setTitle("\u{1F6D1} Sessions stopped")
      .setDescription(`Stopped tracking your messages for:\n${stopped.map((s) => `\u2022 **${s}**`).join("\n")}`)
      .setFooter({ text: "You can start a new game any time" });
    await message.reply({ embeds: [embed] });
  } else {
    const embed = baseEmbed(COLORS.info)
      .setTitle("\u{1F6D1} No active sessions")
      .setDescription("I'm not tracking any of your messages in this channel.")
      .setFooter({ text: "Wordle, Word Chain, Number Guess, 2048, Minesweeper" });
    await message.reply({ embeds: [embed] });
  }
}
