import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

export const name = "fact";
export const description = "Random fun fact";
export const usage = "!fact";
export const category = "fun";

const FACTS = [
  "Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that's still edible.",
  "A group of flamingos is called a 'flamboyance'.",
  "Bananas are berries, but strawberries aren't.",
  "Octopuses have three hearts and blue blood.",
  "The Eiffel Tower can grow up to 6 inches taller in summer due to thermal expansion.",
  "A day on Venus is longer than a year on Venus.",
  "Sharks existed before trees evolved.",
  "The unicorn is the national animal of Scotland.",
  "Bees can recognize human faces.",
  "Wombats produce cube-shaped poop.",
  "There are more stars in the universe than grains of sand on Earth.",
  "Sea otters hold hands while sleeping so they don't drift apart.",
  "A shrimp's heart is in its head.",
  "The dot over a lowercase i or j is called a tittle.",
  "Cleopatra lived closer in time to the moon landing than to the building of the Great Pyramid.",
];

export async function execute(message) {
  if (!(await applyCooldown(message, "fact", "fun"))) return;
  const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
  const embed = baseEmbed(COLORS.info)
    .setTitle("💡 Did You Know?")
    .setDescription(fact);
  await message.reply({ embeds: [embed] });
}
