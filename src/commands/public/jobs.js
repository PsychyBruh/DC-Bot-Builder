import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { JOBS } from "../../storage/economy.js";

export const name = "jobs";
export const description = "List all available jobs";
export const usage = "!jobs";
export const category = "economy";

function fmtCd(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

export async function execute(message) {
  const lines = JOBS.map((j) => `${j.emoji} **${j.name}** \u2014 ${EMOJIS.coin} **${j.base}**/shift | cooldown **${fmtCd(j.cooldown)}**\n> _${j.desc}_`);
  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${EMOJIS.money} Available Jobs`)
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: `Use !job <name> to take one. Switching jobs costs a 24h cooldown.` });
  await message.reply({ embeds: [embed] });
}
