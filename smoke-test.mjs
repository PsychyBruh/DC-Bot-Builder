import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "src");

let total = 0;
let failed = 0;

async function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
    } else if (entry.name.endsWith(".js")) {
      total++;
      try {
        const mod = await import(pathToFileURL(full).href);
        if (mod.name && !mod.execute && !mod.default) {
          console.log(`  NOTE: ${full} exports name but no execute (check) -> ${mod.name}`);
        }
      } catch (err) {
        failed++;
        console.log(`FAIL: ${full}`);
        console.log(`  ${err.message}`);
      }
    }
  }
}

await walk(root);
console.log(`\nImported ${total} modules, ${failed} failed.`);
process.exit(failed ? 1 : 0);
