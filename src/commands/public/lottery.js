import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";
import { getUser, adjustBalance } from "../../storage/users.js";
import { getLottery, buyTicket, myTickets, draw } from "../../storage/lottery.js";

export const name = "lottery";
export const description = "Buy a lottery ticket (100c). Hourly draw, jackpot grows!";
export const usage = "!lottery [buy|draw]";
export const category = "games";

export async function execute(message, args) {
  const sub = (args[0] || "").toLowerCase();
  if (sub === "draw") {
    if (message.member?.permissions?.has("Administrator")) {
      const r = draw(true);
      const winner = r.winnerId ? `<@${r.winnerId}>` : "nobody (no tickets)";
      return message.reply({ embeds: [baseEmbed(COLORS.gold).setTitle(`${"\u{1F381}"} Lottery Draw (forced)`).setDescription(`Jackpot: ${EMOJIS.coin} **${r.pot.toLocaleString()}**\nWinner: ${winner}`)] });
    }
    return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`Auto-draw runs hourly. To force one, ask an admin.`)] });
  }

  // default: buy a ticket
  const lot = getLottery();
  const bal = getUser(message.author.id).balance || 0;
  if (bal < lot.ticketPrice) return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} You need ${EMOJIS.coin} **${lot.ticketPrice}** for a ticket (balance: ${bal.toLocaleString()}).`)] });
  const cd = await applyCooldown(message, "lottery", "economy");
  if (!cd) return;
  adjustBalance(message.author.id, -lot.ticketPrice);
  const sold = buyTicket(message.author.id);
  const mine = myTickets(message.author.id);
  const next = Math.max(0, lot.drawInterval - (Date.now() - lot.lastDraw));
  const embed = baseEmbed(COLORS.gold)
    .setTitle(`${"\u{1F381}"} Lottery Ticket`)
    .setDescription(`${EMOJIS.check} Bought a ticket for ${EMOJIS.coin} **${lot.ticketPrice}**.\n\n${"\u{1F4B0}"} Current jackpot: **${lot.jackpot.toLocaleString()}**\n${"\u{1F3B1}"} Total tickets sold this round: **${sold}** (you have **${mine}**)\nNext auto-draw: **${fmtDur(next)}**`)
    .setFooter({ text: `Buy more tickets to boost your odds!` });
  await message.reply({ embeds: [embed] });
}

function fmtDur(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
