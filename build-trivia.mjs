import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const TMP_DIR = "C:\\Users\\psychy\\.local\\share\\opencode\\tool-output";

const CATEGORY_FILES = {
  general: "tool_fbbc59b48001KmCmVMstQxvaZY",
  "science-technology": "tool_fbbc59cba001CUjWJOaZXaEo6T",
  history: "tool_fbbc59e02001Ubr9184yNI66yH",
  geography: "tool_fbbc59f580017JpSFdRrabnqhz",
  animals: "tool_fbbc5b455001t0vagtiZn300oA",
  "brain-teasers": "tool_fbbc5c7d90011qsg3K45rmb0vm",
  celebrities: "tool_fbbc5d5a6001gPIYEs9qrhK3Nz",
  entertainment: "tool_fbbc5d65c001s55yVx8eL5oyt1",
  "for-kids": "tool_fbbc5d75c00131AB7RDZfjDjR6",
  hobbies: "tool_fbbc5d864001cVFTs8b9d23HxS",
  humanities: "tool_fbbc5d96b001Z2yP056k6Mdcb5",
  literature: "tool_fbbc6025e001zLuNrANIqK2lxY",
  movies: "tool_fbbc6147e00160Jxmt3FvhD65s",
  music: "tool_fbbc61b9d001Pe7E3SFA2VaZGD",
  people: "tool_fbbc61c94001MLDZGofMGhOTfz",
  "religion-faith": "tool_fbbc61e12001uuQ8Xb1tTuEQGU",
  sports: "tool_fbbc61fb8001S32kNV0V2LOvrm",
  television: "tool_fbbc6212c001xoJsvaaa0soiZQ",
  "video-games": "tool_fbbc62343001nIzfHaZh2aix13",
  world: "tool_fbbc624f0001N0epXRx5EfBv0R",
};

const PER_CATEGORY = 500;

const ENTITY_MAP = {
  "&": "&",
  "&#039;": "'",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&ldquo;": '"',
  "&rdquo;": '"',
  "&ldquo;": '"',
  "&nbsp;": " ",
  "&hellip;": "...",
  "&mdash;": "-",
  "&ndash;": "-",
  "&eacute;": "e",
  "&aacute;": "a",
  "&iacute;": "i",
  "&oacute;": "o",
  "&uacute;": "u",
  "&ntilde;": "n",
  "&auml;": "a",
  "&ouml;": "o",
  "&uuml;": "u",
  "&iuml;": "i",
  "&euml;": "e",
  "&ccedil;": "c",
  "&Aacute;": "A",
  "&Eacute;": "E",
  "&Iacute;": "I",
  "&Oacute;": "O",
  "&Uacute;": "U",
  "&Auml;": "A",
  "&Ouml;": "O",
  "&Uuml;": "U",
  "&times;": "x",
  "&divide;": "/",
  "&deg;": " degrees ",
  "&hearts;": "hearts",
  "&spades;": "spades",
  "&clubs;": "clubs",
  "&diams;": "diamonds",
  "&trade;": "(TM)",
  "&copy;": "(c)",
  "&reg;": "(R)",
};

function cleanEntities(text) {
  if (typeof text !== "string") return text;
  let out = text;
  for (const [entity, replacement] of Object.entries(ENTITY_MAP)) {
    out = out.split(entity).join(replacement);
  }
  out = out.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const allQuestions = [];
const stats = {};

for (const [category, fileId] of Object.entries(CATEGORY_FILES)) {
  const filePath = join(TMP_DIR, fileId);
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (e) {
    console.error(`Could not read ${fileId} for category ${category}: ${e.message}`);
    continue;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`JSON parse failed for ${category} (${fileId}): ${e.message}`);
    continue;
  }

  if (!Array.isArray(parsed)) {
    console.error(`${category}: not an array, skipping`);
    continue;
  }

  const clean = parsed
    .filter((q) => q && q.question && Array.isArray(q.choices) && q.answer && q.choices.length >= 4)
    .map((q) => {
      const choices = q.choices.map(cleanEntities);
      const answer = cleanEntities(q.answer);
      const answerIdx = choices.indexOf(answer);
      const acceptedAnswers = [answer.toLowerCase()];
      choices.forEach((c, i) => {
        if (i !== answerIdx && c.toLowerCase().includes(answer.toLowerCase())) {
          acceptedAnswers.push(c.toLowerCase());
        }
      });
      return {
        q: cleanEntities(q.question),
        opts: choices,
        a: [...new Set(acceptedAnswers)],
        cat: category,
      };
    })
    .filter((q) => q.opts.length === 4 && q.a.length > 0 && q.a[0].length > 0)
    .filter((q) => q.opts.some((o) => q.a.some((ans) => o.toLowerCase().includes(ans) || ans.includes(o.toLowerCase()))));

  const picked = shuffle(clean).slice(0, PER_CATEGORY);
  stats[category] = { available: clean.length, picked: picked.length };
  allQuestions.push(...picked);
  console.log(`${category}: ${picked.length}/${clean.length} (raw: ${parsed.length})`);
}

const shuffled = shuffle(allQuestions);
const outPath = "data/trivia-questions.json";
writeFileSync(outPath, JSON.stringify(shuffled), "utf8");

let totalRaw = 0, totalPicked = 0;
for (const [cat, s] of Object.entries(stats)) {
  totalRaw += s.available;
  totalPicked += s.picked;
}
console.log(`\nTotal raw questions (after cleaning): ${totalRaw}`);
console.log(`Total picked: ${totalPicked}`);
console.log(`Written to ${outPath}`);
