import { baseEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { updateUser } from "../../storage/users.js";

export const name = "quit";
export const description = "Quit your current job";
export const usage = "!quit";
export const category = "economy";

export async function execute(message) {
  updateUser(message.author.id, (u) => {
    u.job = null;
    u.lastWork = 0;
    return u;
  });
  await message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`${EMOJIS.check} Quit your job. Use \`!job <name>\` to take a new one.`)] });
}
