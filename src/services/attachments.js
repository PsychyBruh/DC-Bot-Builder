// Reads text-based attachments (.txt, .md, code, data files) so AI commands can use their contents.

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "log", "csv", "tsv", "json", "jsonl", "yaml", "yml", "toml", "ini", "cfg", "conf", "env",
  "xml", "html", "htm", "css", "scss", "js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "rb", "go", "rs", "java", "kt",
  "c", "h", "cpp", "hpp", "cs", "php", "lua", "luau", "sh", "bash", "ps1", "bat", "sql", "swift", "dart", "r", "srt", "vtt",
]);
const MAX_FILE_BYTES = 200_000;   // skip anything bigger than ~200 KB
const MAX_TOTAL_CHARS = 60_000;   // keep the prompt a sane size across all files

function isTextAttachment(att) {
  const ext = (att.name || "").split(".").pop().toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || (att.contentType || "").startsWith("text/");
}

// Returns { text, used: [names], skipped: [ "name (reason)" ] }.
// `text` is ready to append to a prompt (empty string when nothing was readable).
export async function readTextAttachments(message) {
  const used = [];
  const skipped = [];
  const parts = [];
  let budget = MAX_TOTAL_CHARS;

  for (const att of message.attachments?.values?.() ?? []) {
    if (!isTextAttachment(att)) { skipped.push(`${att.name} (not a text file)`); continue; }
    if (att.size > MAX_FILE_BYTES) { skipped.push(`${att.name} (too big)`); continue; }
    if (budget <= 0) { skipped.push(`${att.name} (over the total size limit)`); continue; }
    try {
      const res = await fetch(att.url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let body = await res.text();
      let note = "";
      if (body.length > budget) { body = body.slice(0, budget); note = "\n[...truncated]"; }
      budget -= body.length;
      parts.push(`--- File: ${att.name} ---\n${body}${note}\n--- End of ${att.name} ---`);
      used.push(att.name);
    } catch (err) {
      skipped.push(`${att.name} (couldn't download)`);
    }
  }

  return { text: parts.join("\n\n"), used, skipped };
}
