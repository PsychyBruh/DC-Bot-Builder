import { baseEmbed, COLORS } from "../utils/embeds.js";
import { applyCooldown } from "../utils/cooldown.js";

const games = new Map();

const WORDS = [
  "about", "above", "actor", "acute", "admit", "adopt", "adult", "after", "again", "agent",
  "agree", "ahead", "album", "alert", "alike", "alive", "allow", "alone", "along", "alter",
  "angel", "anger", "angle", "angry", "ankle", "apart", "apple", "apply", "arena", "argue",
  "arise", "array", "arrow", "aside", "asset", "audio", "audit", "avoid", "award", "aware",
  "badge", "baker", "banjo", "basic", "baton", "beach", "beard", "beast", "begin", "being",
  "below", "bench", "bible", "birth", "black", "blade", "blame", "blank", "blast", "blaze",
  "bleed", "blend", "bless", "blind", "block", "blood", "bloom", "blues", "bluff", "board",
  "bonus", "booth", "bound", "brain", "brake", "brand", "brave", "bread", "break", "breed",
  "brick", "bride", "brief", "bring", "broad", "broil", "broke", "brood", "brown", "brush",
  "bunch", "burst", "buyer", "cabin", "cable", "camel", "candy", "cargo", "carol", "carry",
  "catch", "cause", "cease", "chain", "chair", "chaos", "charm", "chart", "chase", "cheap",
  "check", "cheek", "cheer", "chess", "chest", "chief", "child", "chill", "china", "choir",
  "choke", "chord", "chunk", "civic", "civil", "claim", "clash", "class", "clean", "clear",
  "clerk", "click", "cliff", "climb", "cling", "clock", "clone", "close", "cloth", "cloud",
  "clown", "coach", "coast", "cobra", "cocoa", "colon", "color", "comet", "comic", "coral",
  "corps", "costs", "couch", "cough", "count", "court", "cover", "crack", "craft", "crane",
  "crash", "crazy", "cream", "creek", "crest", "crime", "crisp", "cross", "crowd", "crown",
  "crude", "cruel", "crumb", "crush", "curve", "cycle", "daily", "dairy", "dance", "dated",
  "dealt", "death", "debut", "delay", "delta", "dense", "depth", "derby", "deter", "devil",
  "digit", "dimly", "diode", "dirty", "ditch", "diver", "dizzy", "dodge", "doing", "dolly",
  "donor", "donut", "doubt", "dough", "dozen", "draft", "drain", "drama", "drank", "drape",
  "dream", "dress", "dried", "drift", "drill", "drink", "drive", "drove", "drown", "drums",
  "dummy", "dumpy", "dutch", "dwarf", "dying", "eager", "eagle", "early", "earth", "eight",
  "elbow", "elder", "elect", "elegy", "elite", "elope", "elude", "ember", "empty", "enemy",
  "enjoy", "enter", "entry", "envoy", "epoxy", "equal", "equip", "erase", "erect", "error",
  "erupt", "essay", "ether", "event", "every", "exact", "exalt", "exams", "excel", "exert",
  "exile", "exist", "extra", "fable", "facet", "faint", "fairy", "faith", "false", "fancy",
  "farce", "fatal", "fault", "fauna", "favor", "feast", "fence", "ferry", "fever", "fiber",
  "field", "fiery", "fifth", "fifty", "fight", "final", "first", "fixed", "flame", "flash",
  "fleet", "flesh", "flint", "float", "flock", "flood", "floor", "flour", "fluid", "flute",
  "focus", "foggy", "folks", "force", "forge", "forth", "forty", "forum", "found", "frame",
  "fraud", "fresh", "front", "frost", "froze", "fruit", "fudge", "fudge", "fully", "funds",
  "funny", "gaffe", "gauge", "genie", "genre", "ghost", "giant", "given", "glass", "glaze",
  "gleam", "glide", "globe", "glory", "gloss", "glove", "glued", "going", "goose", "gorge",
  "grace", "grade", "grain", "grand", "grant", "grape", "graph", "grasp", "grass", "grave",
  "great", "greed", "green", "greet", "grief", "grill", "grind", "gripe", "gross", "group",
  "grove", "grown", "guard", "guess", "guest", "guide", "guild", "guilt", "habit", "happy",
  "harsh", "haste", "haven", "hazel", "heart", "heavy", "hedge", "hello", "hence", "heron",
  "hilly", "hinge", "hippo", "hobby", "honey", "horse", "hotel", "house", "hover", "human",
  "humor", "hurry", "ideal", "image", "imply", "index", "inner", "input", "irony", "issue",
  "ivory", "jeans", "jelly", "jewel", "joint", "jolly", "judge", "juice", "juicy", "jumbo",
  "jumpy", "karma", "kayak", "kebab", "kettle", "kneel", "knees", "knife", "knock", "known",
  "koala", "label", "labor", "laden", "lance", "large", "laser", "later", "laugh", "layer",
  "learn", "lease", "least", "leave", "legal", "lemon", "level", "lever", "light", "limit",
  "linen", "liner", "liver", "lobby", "local", "lodge", "logic", "loose", "loyal", "lunar",
  "lunch", "lyric", "macro", "magic", "major", "maker", "mango", "manor", "maple", "march",
  "marsh", "mason", "match", "maybe", "mayor", "meant", "media", "melon", "mercy", "merge",
  "merit", "merry", "metal", "meter", "micro", "midst", "might", "minor", "minus", "mitre",
  "mixed", "model", "modem", "moist", "money", "month", "moral", "motor", "mount", "mouse",
  "mouth", "movie", "multi", "music", "nadir", "naive", "naked", "nanny", "naval", "needs",
  "nerve", "never", "newer", "newly", "nicer", "night", "ninja", "ninth", "noble", "noise",
  "north", "notch", "noted", "novel", "nudge", "nurse", "nylon", "oasis", "obese", "occur",
  "ocean", "offer", "often", "olive", "onion", "onset", "opera", "orbit", "order", "organ",
  "other", "ought", "ounce", "outer", "owner", "ozone", "paint", "panel", "panic", "paper",
  "parch", "parka", "party", "paste", "patch", "pause", "peace", "peach", "pearl", "pedal",
  "penny", "peony", "perch", "peril", "petal", "phase", "phone", "photo", "piano", "piece",
  "pilot", "pinch", "pitch", "pivot", "pixel", "pizza", "place", "plain", "plane", "plant",
  "plate", "plaza", "plead", "pluck", "plume", "plump", "plush", "poems", "point", "polar",
  "polls", "porch", "pouch", "pound", "power", "press", "price", "pride", "prime", "print",
  "prior", "prize", "probe", "prone", "proof", "proud", "prove", "proxy", "prune", "psalm",
  "pulse", "punch", "puree", "purse", "pursy", "queen", "query", "quest", "queue", "quick",
  "quiet", "quill", "quilt", "quirk", "quite", "quota", "quote", "radar", "radio", "rainy",
  "raise", "rally", "ranch", "range", "rapid", "ratio", "raven", "reach", "react", "ready",
  "realm", "rebel", "refer", "reign", "relax", "relay", "remit", "renal", "renew", "repay",
  "reply", "resin", "retro", "reuse", "rhyme", "ridge", "rifle", "right", "rigid", "rinse",
  "ripen", "risen", "risky", "rival", "river", "roast", "robin", "robot", "rocky", "rogue",
  "roger", "roman", "roomy", "roses", "rouge", "rough", "round", "route", "royal", "rugby",
  "ruler", "rumor", "rural", "sadly", "saint", "salad", "sales", "salon", "salsa", "sandy",
  "sauce", "sauna", "scale", "scalp", "scare", "scarf", "scene", "scent", "scout", "scrap",
  "screw", "scrub", "seize", "sense", "serve", "setup", "seven", "shack", "shade", "shake",
  "shall", "shame", "shape", "share", "shark", "sharp", "sheep", "sheer", "sheet", "shelf",
  "shell", "shift", "shine", "shirt", "shock", "shoot", "shore", "short", "shout", "shove",
  "shown", "shrub", "siege", "sight", "sigma", "silly", "since", "siren", "situy", "sixth",
  "sixty", "skill", "skirt", "skull", "slant", "sleep", "slice", "slide", "slope", "smart",
  "smell", "smile", "smoke", "snack", "snake", "sneak", "snowy", "sober", "solar", "solid",
  "solve", "sonic", "sorry", "sound", "south", "space", "spare", "spark", "speak", "spear",
  "spend", "spice", "spike", "spill", "spine", "spoke", "spoon", "sport", "spray", "squad",
  "stack", "staff", "stage", "stair", "stake", "stale", "stand", "stare", "start", "state",
  "stays", "stead", "steam", "steel", "steep", "steer", "stern", "stick", "stiff", "still",
  "stock", "stoke", "stole", "stone", "stood", "stool", "store", "storm", "story", "stout",
  "strap", "straw", "stray", "strip", "study", "stuff", "style", "sugar", "suite", "sunny",
  "super", "surge", "swamp", "swarm", "swift", "swing", "sword", "syrup", "table", "taste",
  "teach", "tease", "teens", "tempo", "tempt", "tenth", "thank", "theft", "their", "theme",
  "there", "these", "thick", "thief", "thing", "think", "third", "thorn", "those", "three",
  "threw", "throw", "thumb", "tidal", "tiger", "tight", "timer", "tired", "title", "toast",
  "today", "token", "tombs", "topic", "torch", "total", "touch", "tough", "towel", "tower",
  "toxic", "trace", "track", "trade", "trail", "train", "trait", "tramp", "trapz", "trash",
  "treat", "trend", "trial", "tribe", "trick", "tried", "troop", "truck", "truly", "trump",
  "trunk", "trust", "truth", "tulip", "tumor", "tuned", "twice", "twist", "tying", "ulcer",
  "ultra", "uncle", "under", "unfit", "union", "unite", "unity", "until", "upper", "upset",
  "urban", "usage", "usual", "utter", "vacua", "vague", "valid", "value", "valve", "vapor",
  "vault", "vegan", "veins", "velar", "veldt", "venom", "venue", "verge", "verse", "video",
  "vigil", "vinyl", "viola", "viper", "viral", "virus", "visit", "vista", "vital", "vivid",
  "vocal", "vodka", "voice", "volta", "voter", "vouch", "vowdy", "wafer", "wagon", "waist",
  "waive", "waltz", "watch", "water", "waxen", "weary", "weave", "wedge", "weird", "whale",
  "wheat", "wheel", "where", "which", "while", "whine", "whirl", "white", "whole", "whose",
  "widen", "width", "witch", "woman", "women", "world", "worry", "worse", "worst", "worth",
  "would", "wound", "woven", "wreck", "writh", "wrist", "write", "wrong", "wrote", "yacht",
  "yield", "young", "youth", "zealot", "zebra", "zesty",
];

export { WORDS };

export const name = "wordle";
export const description = "Wordle! Guess the 5-letter word in 6 tries";
export const usage = "!wordle";
export const category = "games";

export async function execute(message) {
  if (!(await applyCooldown(message, "wordle", "heavy"))) return;
  const word = WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
  const game = { word, guesses: [], won: false };
  games.set(`${message.channelId}:${message.author.id}`, game);
  const embed = baseEmbed(COLORS.cyan)
    .setTitle("🟩🟨⬛ Wordle")
    .setDescription(`I've picked a **5-letter word**. Guess it in 6 tries!\n\nType a word to guess.\n\n\`\`\`${renderGuesses(game)}\`\`\``)
    .setFooter({ text: "Tries left: 6" });
  await message.reply({ embeds: [embed] });
}

function renderGuesses(game) {
  if (!game.guesses.length) return "⚪⚪⚪⚪⚪";
  const lines = game.guesses.map((g) => {
    const chars = [...g.word];
    const target = [...game.word];
    const result = Array(5).fill("⬛");
    const used = Array(5).fill(false);
    for (let i = 0; i < 5; i++) {
      if (chars[i] === target[i]) { result[i] = "🟩"; used[i] = true; }
    }
    for (let i = 0; i < 5; i++) {
      if (result[i] === "🟩") continue;
      const idx = target.findIndex((t, j) => t === chars[i] && !used[j]);
      if (idx !== -1) { result[i] = "🟨"; used[idx] = true; }
    }
    return result.join(" ");
  });
  return lines.join("\n");
}

export async function handleWordleGuess(message, word) {
  const game = games.get(`${message.channelId}:${message.author.id}`);
  if (!game) return false;
  const guess = word.toUpperCase();
  if (!/^[A-Z]{5}$/.test(guess)) {
    await message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("❌ Must be exactly 5 letters.")] });
    return true;
  }
  if (!WORDS.includes(guess.toLowerCase())) {
    await message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("❌ Not in my word list. Try another 5-letter word.")] });
    return true;
  }
  game.guesses.push({ word: guess });
  const triesLeft = 6 - game.guesses.length;
  if (guess === game.word) {
    game.won = true;
    const embed = baseEmbed(COLORS.success)
      .setTitle("🎉 You got it!")
      .setDescription(`\`\`\`${renderGuesses(game)}\`\`\`\n\nThe word was **${game.word}**. Solved in ${game.guesses.length}/6!`);
    games.delete(`${message.channelId}:${message.author.id}`);
    await message.reply({ embeds: [embed] });
    return true;
  }
  if (triesLeft <= 0) {
    const embed = baseEmbed(COLORS.danger)
      .setTitle("😢 Out of tries!")
      .setDescription(`\`\`\`${renderGuesses(game)}\`\`\`\n\nThe word was **${game.word}**.`);
    games.delete(`${message.channelId}:${message.author.id}`);
    await message.reply({ embeds: [embed] });
    return true;
  }
  const embed = baseEmbed(COLORS.cyan)
    .setTitle("🟩🟨⬛ Wordle")
    .setDescription(`\`\`\`${renderGuesses(game)}\`\`\`\n\nTries left: **${triesLeft}**`)
    .setFooter({ text: "🟩 = correct position, 🟨 = in word, ⬛ = not in word" });
  await message.reply({ embeds: [embed] });
  return true;
}
