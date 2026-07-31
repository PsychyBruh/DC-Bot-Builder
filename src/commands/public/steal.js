import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance, updateUser } from "../../storage/users.js";
import { activeBooster, isJailed, jailUser, freeFromJail } from "../../storage/economy.js";
import { claimBounty, totalBounty } from "../../storage/bounties.js";

export const name = "steal";
export const description = "Attempt to rob another user. High risk, high reward.";
export const usage = "!steal @user";
export const category = "economy";

const STEAL_CD = 20 * 1000;
const MAX_STEAL = 500;
const JAIL_MS = 10 * 60 * 1000;

export async function execute(message, args) {
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Usage: \`!steal @user\``)] });
  if (target.id === message.author.id) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Can't steal from yourself.`)] });
  if (target.bot) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Bots have no coin.`)] });

  // Is the thief jailed?
  const jailUntil = isJailed(message.author.id);
  if (jailUntil) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You're in jail until **${timeLeft(jailUntil)}**. Use \`!bail\`.`)] });

  if (!(await applyCooldown(message, "steal", "crime"))) return;

  // Targets with shield immunity can't be stolen from
  const shieldUntil = activeBooster(target.id, "shield");
  if (shieldUntil) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`${ "\u{1F6E1}\uFE0F"} ${target.username} is shielded. You'll have to wait.`)] });
  const stealImmune = getUser(target.id).stealImmune;
  if (stealImmune && stealImmune > Date.now()) return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`${ "\u{1F6E1}\uFE0F"} ${target.username} has bribe immunity.`)] });

  const targetBal = getUser(target.id).balance || 0;
  if (targetBal < 1) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} ${target.username} has nothing to steal.`)] });

  // Success chance: 30%. Shielded luck users gain +5% per luck booster — only meaningful for thief luck.
  let chance = 0.30;
  if (activeBooster(message.author.id, "luck")) chance += 0.05;
  const success = Math.random() < chance;

  if (!success) {
    // Fail: pay fine = 10% of your balance (min 50) and increment fail count
    const bal = getUser(message.author.id).balance || 0;
    const fine = Math.max(50, Math.floor(bal * 0.10));
    adjustBalance(message.author.id, -fine);
    updateUser(message.author.id, (u) => { u.stealFails = (u.stealFails || 0) + 1; return u; });
    let jailed = false;
    if ((getUser(message.author.id).stealFails || 0) >= 3) {
      jailUser(message.author.id, JAIL_MS);
      jailed = true;
    }
    const embed = baseEmbed(COLORS.danger)
      .setTitle(`${"\u{1F575}\uFE0F"} Steal Failed`)
      .setDescription(`You tried to rob ${target.username} but got caught.\n${EMOJIS.coin} Fined **${fine.toLocaleString()}** coins.${jailed ? `\n\n${"\u{1F6AB}"} 3 failed attempts \u2014 you're **jailed** for 10 minutes!` : `\n\n${"\u{1F463}"} Fail streak: **${getUser(message.author.id).stealFails}/3**`}`)
      .setFooter({ text: "Use !bail to escape jail (costs 500c, or use a Bribe Token)" });
    return message.reply({ embeds: [embed] });
  }

  // Success: steal min(targetBal, 50..MAX_STEAL)
  const stolen = Math.min(targetBal, Math.floor(Math.random() * (MAX_STEAL - 50 + 1)) + 50);
  adjustBalance(target.id, -stolen);
  adjustBalance(message.author.id, stolen);
  updateUser(message.author.id, (u) => { u.stealFails = 0; return u; });

  // Claim bounties on target
  const bountyPayout = claimBounty(message.author.id, target.id);
  let bountyLine = "";
  if (bountyPayout > 0) {
    adjustBalance(message.author.id, bountyPayout);
    bountyLine = `\n\n${"\u{1F4B0}"} You also collected a **${bountyPayout.toLocaleString()}** bounty on ${target.username}!`;
  }

  const embed = baseEmbed(COLORS.success)
    .setTitle(`${"\u{1F575}\uFE0F"} Steal Success`)
    .setDescription(`You robbed ${EMOJIS.coin} **${stolen.toLocaleString()}** from **${target.username}**!${bountyLine}`)
    .setFooter({ text: `\u2694\uFE0F Watch out for revenge! They may place a bounty on you.` });
  await message.reply({ embeds: [embed] });
}

function timeLeft(ms) {
  const sec = Math.ceil((ms - Date.now()) / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}
