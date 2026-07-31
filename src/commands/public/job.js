import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { JOBS, JOB_SWITCH_COOLDOWN } from "../../storage/economy.js";
import { getUser, updateUser } from "../../storage/users.js";

export const name = "job";
export const description = "Take a job. !job <name>";
export const usage = "!job <miner|farmer|...>";
export const category = "economy";

export async function execute(message, args) {
  if (!args[0]) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!job <name>\` (see ${"`"}!jobs${"`"})`)] });
  const query = args[0].toLowerCase();
  const job = JOBS.find((j) => j.id === query || j.name.toLowerCase() === query);
  if (!job) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Unknown job. See \`!jobs\`.`)] });

  const u = getUser(message.author.id);
  if (u.job === job.id) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`You're already a ${job.emoji} **${job.name}**.`)] });

  const lastSwitch = u.jobSwitchAt || 0;
  if (lastSwitch && Date.now() - lastSwitch < JOB_SWITCH_COOLDOWN) {
    const wait = JOB_SWITCH_COOLDOWN - (Date.now() - lastSwitch);
    const waitStr = wait >= 3600000 ? `${Math.ceil(wait / 3600000)}h` : `${Math.ceil(wait / 60000)}m`;
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You switched jobs recently. Try again in **${waitStr}**.`)] });
  }

  updateUser(message.author.id, (d) => {
    d.job = job.id;
    d.jobSwitchAt = Date.now();
    d.lastWork = 0;
    return d;
  });
  const embed = baseEmbed(COLORS.success)
    .setTitle(`${job.emoji} Hired!`)
    .setDescription(`You're now a **${job.name}**.\n\nBase pay: ${EMOJIS.coin} **${job.base}**/shift\nCooldown: **${Math.round(job.cooldown / 60000)}m**\n\nUse \`!work\` to earn.`)
    .setFooter({ text: "Switching again will cost a 24h cooldown" });
  await message.reply({ embeds: [embed] });
}
