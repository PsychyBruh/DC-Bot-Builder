import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { exec } from "child_process";
import { promisify } from "util";
import { applyCooldown } from "../utils/cooldown.js";

const execAsync = promisify(exec);
const FETCH_EVERY_MS = 5 * 60 * 1000;
let lastFetch = 0;

export const name = "update";
export const description = "Show the latest bot updates and recent changes.";
export const usage = "!update";
export const category = "info";

// Async so a slow git call never blocks the bot's event loop.
async function safeExec(cmd) {
  try {
    const { stdout } = await execAsync(cmd, { cwd: process.cwd(), encoding: "utf8", timeout: 8000 });
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function execute(message) {
  if (!(await applyCooldown(message, "update", "social"))) return;
  const sha = await safeExec("git rev-parse --short HEAD");
  const date = await safeExec("git log -1 --pretty=%ad --date=relative");
  const branch = (await safeExec("git rev-parse --abbrev-ref HEAD")) || "main";

  // Hit the network at most once every few minutes, no matter who runs this.
  if (Date.now() - lastFetch > FETCH_EVERY_MS) {
    lastFetch = Date.now();
    await safeExec("git fetch origin --quiet");
  }

  const behind = await safeExec(`git rev-list --count HEAD..origin/${branch}`);
  const ahead = await safeExec(`git rev-list --count origin/${branch}..HEAD`);

  const log = await safeExec("git log -6 --pretty=%h|%ad|%s --date=short");

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

  const fields = [];
  fields.push({ name: "Current build", value: `\`${sha || "n/a"}\` on \`${branch}\`\nDeployed ${date || "recently"}`, inline: false });

  const statusParts = [];
  if (behind && behind !== "0") statusParts.push(`${behind} commit(s) behind origin/${branch}`);
  if (ahead && ahead !== "0") statusParts.push(`${ahead} commit(s) ahead of origin/${branch}`);
  if (statusParts.length > 0) {
    fields.push({ name: "Sync status", value: statusParts.join("\n") + `\n\nRun \`botctl update\` to deploy the latest changes.`, inline: false });
  } else {
    fields.push({ name: "Sync status", value: `\u{2705} Up to date with origin/${branch}`, inline: false });
  }

  const embed = baseEmbed(COLORS.info)
    .setTitle(`${EMOJIS.rocket} Project Nova \u2014 Update Log`)
    .setDescription(lines.length ? lines.join("\n") : "No commit info available.")
    .addFields(...fields)
    .setFooter({ text: "Run !update anytime to see the latest changes" });
  await message.reply({ embeds: [embed] });
}
