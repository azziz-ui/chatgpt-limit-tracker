import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import "./build.mjs";
import pkg from "../package.json" with { type: "json" };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "dist/chatgpt-limit-tracker");
const files = {};
async function walk(folder, prefix = "") {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) await walk(path.join(folder, entry.name), `${name}/`);
    else files[`chatgpt-limit-tracker/${name}`] = new Uint8Array(await readFile(path.join(folder, entry.name)));
  }
}
await walk(directory);
const destination = path.join(root, `chatgpt-limit-tracker-${pkg.version}.zip`);
await writeFile(destination, zipSync(files, { level: 9 }));
console.log(`Packaged: ${destination}`);
