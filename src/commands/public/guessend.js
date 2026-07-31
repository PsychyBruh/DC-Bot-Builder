import { baseEmbed, COLORS } from "../utils/embeds.js";
import { deleteGuessGame } from "./guess.js";

export const name = "guessend";
export const description = "End your active guess game";
export const usage = "!guessend";
export const category = "games";

export async function execute(message) {
  if (deleteGuessGame(message.author.id)) {
    await message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("❌ Game aborted")] });
  } else {
    await message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ No active game")] });
  }
}
