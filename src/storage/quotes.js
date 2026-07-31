import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "quotes.json");

let quotes = [];

export function loadQuotes() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      quotes = JSON.parse(raw);
    } else {
      quotes = [
        { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
        { text: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
        { text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
        { text: "Two roads diverged in a wood, and I took the one less traveled by.", author: "Robert Frost" },
        { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
        { text: "If you can dream it, you can do it.", author: "Walt Disney" },
      ];
      save();
    }
  } catch (err) {
    console.error("Failed to load quotes:", err.message);
  }
}

function save() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(quotes, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save quotes:", err.message);
  }
}

export function getRandomQuote() {
  if (quotes.length === 0) return null;
  return quotes[Math.floor(Math.random() * quotes.length)];
}

export function addQuote(text, author) {
  quotes.push({ text, author });
  save();
}

export function clearAllQuotes() {
  quotes = [];
  save();
}
