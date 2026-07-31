import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "ship";
export const description = "Ship two users and get a love percentage";
export const usage = "!ship @user1 @user2";
export const category = "games";

function hashLove(a, b) {
  let s = [...a].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  let t = [...b].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const combined = s * t;
  const seed = (combined * 31 + combined * 17) >>> 0;
  return seed % 101;
}

export async function execute(message, args) {
  if (!(await applyCooldown(message, "ship", "fun"))) return;
  const users = message.mentions.users;
  if (users.size < 2) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`${EMOJIS.cross} Mention two users: \`!ship @user1 @user2\``)] });
  }
  const [a, b] = [...users.values()];
  const id1 = a.id < b.id ? a.id : b.id;
  const id2 = a.id < b.id ? b.id : a.id;
  const pct = hashLove(id1, id2);

  let bar = "";
  const filledCount = Math.floor(pct / 10);
  for (let i = 0; i < 10; i++) {
    bar += i < filledCount ? "🟥" : "⬛";
  }

  let verdict = "";
  if (pct >= 90) verdict = "💍 **MARRY THEM**";
  else if (pct >= 75) verdict = "🔥 **Soulmates**";
  else if (pct >= 50) verdict = "💕 **Strong match**";
  else if (pct >= 25) verdict = "💔 **Needs work**";
  else verdict = "🚫 **Stay friends**";

  const embed = baseEmbed(COLORS.pink)
    .setTitle("💘 Shipping...")
    .setDescription(`**${a.username}**  ❤️  **${b.username}**\n\n${bar}\n\n**${pct}%** compatible\n\n${verdict}`)
    .setThumbnail(a.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: "love is in the air" });
  await message.reply({ embeds: [embed] });
}
