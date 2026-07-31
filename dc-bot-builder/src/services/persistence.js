import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const STATE_FILE = path.join(DATA_DIR, "state.jsonl");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function saveLine(type, key, data) {
  ensureDataDir();
  const line = JSON.stringify({ t: type, k: key, d: data, ts: Date.now() }) + "\n";
  try {
    fs.appendFileSync(STATE_FILE, line, "utf-8");
  } catch (err) {
    console.error("Failed to persist:", err.message);
  }
}

export function loadAll() {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) {
    return { contexts: [], conversations: [], pendings: [] };
  }

  const contexts = [];
  const conversations = [];
  const pendings = [];

  try {
    const data = fs.readFileSync(STATE_FILE, "utf-8");
    const lines = data.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.t === "ctx") contexts.push(entry);
        else if (entry.t === "conv") conversations.push(entry);
        else if (entry.t === "pend") pendings.push(entry);
      } catch {
        // skip malformed lines
      }
    }
  } catch (err) {
    console.error("Failed to load state:", err.message);
  }

  return { contexts, conversations, pendings };
}
