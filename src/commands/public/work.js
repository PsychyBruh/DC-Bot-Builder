import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { JOBS, PROPERTY_MAP, activeBooster, computePropertyAccrual } from "../../storage/economy.js";
import { getUser, adjustBalance, updateUser, addXp } from "../../storage/users.js";

export const name = "work";
export const description = "Work your job to earn coins. Boosters & property apply.";
export const usage = "!work";
export const category = "economy";

function fmtCd(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

export async function execute(message) {
  const u = getUser(message.author.id);
  if (!u.job) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You don't have a job. Use \`!job <name>\` (see \`!jobs\`).`)] });
  const job = JOBS.find((j) => j.id === u.job);
  if (!job) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Your job no longer exists. Pick a new one.`)] });

  const now = Date.now();
  const sinceLast = now - (u.lastWork || 0);
  if (sinceLast < job.cooldown) {
    const wait = job.cooldown - sinceLast;
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`${EMOJIS.clock} You're on shift cooldown. Wait **${fmtCd(wait)}**.`)] });
  }

  // Compute earnings: base + variance + level bonus (property income is separate—claimed via !collect)
  const variance = Math.floor(Math.random() * 6) - 3; // -3..+3
  const earned = job.base + variance + (u.level || 0) * 2;

  // Coin booster 2x
  const coinBoost = activeBooster(message.author.id, "coin");
  const boostMult = coinBoost ? 2 : 1;
  const total = Math.max(0, earned) * boostMult;
  adjustBalance(message.author.id, total);
  updateUser(message.author.id, (d) => {
    d.lastWork = now;
    d.jobsWorked = (d.jobsWorked || 0) + 1;
    return d;
  });

  // XP (doubled if xp booster active)
  const xpBoost = activeBooster(message.author.id, "xp");
  const xpAmt = xpBoost ? 20 : 10;
  const { leveledUp, level } = addXp(message.author.id, xpAmt);

  const lines = [
    `${job.emoji} **${message.author.username}** worked as a **${job.name}**`,
    `${EMOJIS.coin} Earned **${total.toLocaleString()}** coins${coinBoost ? " (2x coin boost)" : ""}${variance > 0 ? " (good day!)" : variance < 0 ? " (slow day)" : ""}`,
  ];
  // Hint: passive income accruing (claimed separately)
  if (u.property && PROPERTY_MAP[u.property]) {
    const { owed } = computePropertyAccrual(u);
    if (owed > 0) lines.push(`${PROPERTY_MAP[u.property].emoji} Property accrued: ${EMOJIS.coin} **${owed.toLocaleString()}** — claim with \`!collect\``);
    else lines.push(`${PROPERTY_MAP[u.property].emoji} Property: ${PROPERTY_MAP[u.property].earnRate}/h passive (use \`!collect\`)`);
  }
  lines.push(`${EMOJIS.star} +${xpAmt} XP${xpBoost ? " (2x XP boost)" : ""}`);
  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${job.emoji} Shift done`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `Next shift in ${fmtCd(job.cooldown)} | Level ${level}` });
  if (leveledUp) embed.addFields({ name: "\u{1F389} Level up!", value: `You reached level **${level}** (+2 coins/shift).` });
  await message.reply({ embeds: [embed] });
}
