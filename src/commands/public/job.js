import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { JOBS, jobSwitchCooldown } from "../../storage/economy.js";
import { getUser, updateUser } from "../../storage/users.js";

export const name = "job";
export const description = "Take a job. !job <name>";
export const usage = "!job <miner|farmer|...>";
export const category = "economy";

export async function execute(message, args) {
  if (!args[0]) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!job <name>\` (see \`!jobs\`)`)] });
  const query = args[0].toLowerCase();
  const job = JOBS.find((j) => j.id === query || j.name.toLowerCase() === query);
  if (!job) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Unknown job. See \`!jobs\`.`)] });

  const u = getUser(message.author.id);
  if (u.job === job.id) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`You're already a ${job.emoji} **${job.name}**.`)] });

  // Switch cooldown depends on the *target* job's tier (high-tier jobs have longer waits)
  const switchCd = jobSwitchCooldown(job.id);
  const lastSwitch = u.jobSwitchAt || 0;
  if (lastSwitch && Date.now() - lastSwitch < switchCd) {
    const wait = switchCd - (Date.now() - lastSwitch);
    const waitStr = fmtDur(wait);
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You switched jobs recently. To take **${job.name}**, wait **${waitStr}**.`)] });
  }

  // Work cooldown carries over — swapping jobs does NOT give an immediate fresh shift.
  // (If you last worked 30m ago and a job has a 10m cooldown, you can work right away. If you just worked, you wait.)
  updateUser(message.author.id, (d) => {
    d.job = job.id;
    d.jobSwitchAt = Date.now();
    // intentionally NOT resetting d.lastWork
    return d;
  });

  const currentJob = JOBS.find((j) => j.id === job.id);
  let workNow = "Use `!work` to earn.";
  const sinceLast = Date.now() - (u.lastWork || 0);
  if (sinceLast < currentJob.cooldown) {
    const wait = currentJob.cooldown - sinceLast;
    workNow = `Next shift available in **${fmtDur(wait)}** (your work timer carries over from your previous job).`;
  }

  const embed = baseEmbed(COLORS.success)
    .setTitle(`${job.emoji} Hired!`)
    .setDescription(`You're now a **${job.name}**.\nBase pay: ${EMOJIS.coin} **${job.base}**/shift\nShift cooldown: **${fmtDur(job.cooldown)}**\n\n${workNow}`)
    .setFooter({ text: `Switching again into ${job.name} takes ${fmtDur(switchCd)}.` });
  await message.reply({ embeds: [embed] });
}

function fmtDur(ms) {
  if (ms < 60000) return `${Math.ceil(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.ceil(ms / 60000)}m`;
  return `${Math.ceil(ms / 3600000)}h`;
}
