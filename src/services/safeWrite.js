import fs from "fs";

// Write JSON atomically: write to a temp file, then rename over the target.
// A crash mid-write leaves the previous file intact instead of a truncated one.
export function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}

// Read JSON; if the file is corrupt, back it up so the next save can't silently destroy it.
export function readJsonSafe(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    const backup = `${file}.corrupt-${Date.now()}`;
    try { fs.copyFileSync(file, backup); } catch {}
    console.error(`Corrupt JSON in ${file} (backed up to ${backup}):`, err.message);
    return fallback;
  }
}
