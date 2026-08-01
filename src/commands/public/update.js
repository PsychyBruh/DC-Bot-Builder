import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { execSync } from "child_process";

export const name = "update";
export const description = "Show the latest bot updates and recent changes.";
export const usage = "!update";
export const category = "info";

function safeExec(cmd) {
  try {
    return execSync(cmd, { cwd: process.cwd(), encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return "";
  }
}

export async function execute(message) {
  const sha = safeExec("git rev-parse --short HEAD");
  const date = safeExec("git log -1 --pretty=%ad --date=relative");
  const log = safeExec("git log -6 --pretty=%h|%ad|%s --date=short");

  // Build a bulleted changelog from recent commits (oldest at bottom, newest on top)
  const lines = (log || "")
    .split("\n")
    .filter(Boolean)
    .map((entry) => {
      const [h, d, ...rest] = entry.split("|");
      const subject = rest.join("|");
      const clean = subject.replace(/^[a-z]+:\s*/i, "");
      const short = clean.length > 90 ? clean.slice(0, 87) + "..." : clean;
      return `${EMOJIS.gem} **${short}** \u2014 \`${h}\` (${d})`;
    });

  const embed = baseEmbed(COLORS.info)
    .setTitle(`${EMOJIS.rocket} Project Nova \u2014 Update Log`)
    .setDescription(lines.length ? lines.join("\n") : "No commit info available.")
    .addFields(
      { name: "Current build", value: `\`${sha || "n/a"}\`\nDeployed ${date || "recently"}`, inline: false },
    )
    .setFooter({ text: "Run !update anytime to see the latest changes" });
  await message.reply({ embeds: [embed] });
}
