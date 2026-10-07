import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const STATE_FILE = path.join(DATA_DIR, "state.jsonl");
let cached = null; // loadAll() is called by several stores at startup; read the file once

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

  if (cached) return cached;

  // Only the newest line per (type, key) matters; older lines are superseded.
  const latest = new Map();
  try {
    const data = fs.readFileSync(STATE_FILE, "utf-8");
    const lines = data.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        latest.set(`${entry.t}\u0000${entry.k}`, entry);
      } catch {
        // skip malformed lines
      }
    }
    // Compact: rewrite the append-only log with just the live entries so it stops growing forever.
    if (latest.size < lines.length) {
      const tmp = `${STATE_FILE}.tmp`;
      fs.writeFileSync(tmp, [...latest.values()].map((e) => JSON.stringify(e)).join("\n") + "\n", "utf-8");
      fs.renameSync(tmp, STATE_FILE);
      console.log(`Compacted state.jsonl: ${lines.length} -> ${latest.size} lines`);
    }
  } catch (err) {
    console.error("Failed to load state:", err.message);
  }

  const entries = [...latest.values()];
  cached = {
    contexts: entries.filter((e) => e.t === "ctx"),
    conversations: entries.filter((e) => e.t === "conv"),
    pendings: entries.filter((e) => e.t === "pend"),
  };
  return cached;
}
