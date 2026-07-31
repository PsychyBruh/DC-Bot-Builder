import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "pp";
export const description = "How big is it?";
export const usage = "!pp [@user]";
export const category = "fun";

const SIZES = ["8D", "8=D", "8==D", "8===D", "8====D", "8=====D", "8======D", "8=======D"];

export async function execute(message, args) {
  if (!(await applyCooldown(message, "pp", "fun"))) return;
  const user = message.mentions.users.first() || message.author;
  const seed = [...user.id].reduce((acc, c) => acc + c.charCodeAt(0) + 11, 0);
  const size = SIZES[seed % SIZES.length];
  const embed = baseEmbed(COLORS.pink)
    .setTitle(`${EMOJIS.fire} PP Size Machine`)
    .setDescription(`**${user.username}**'s pp\n\n>>> \`${size}\``);
  await message.reply({ embeds: [embed] });
}
