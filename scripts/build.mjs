import { build } from "esbuild";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist", "chatgpt-limit-tracker");
await mkdir(output, { recursive: true });
await cp(path.join(root, "extension"), output, { recursive: true });
await build({
  entryPoints: [path.join(root, "src/tokenizer.js")],
  outfile: path.join(output, "tokenizer.js"),
  bundle: true, minify: true, format: "iife", platform: "browser", target: "chrome120", legalComments: "eof"
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const tag = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([size, tag, data, crc]);
}

function icon(size) {
  const pixels = Buffer.alloc(size * (1 + size * 4));
  const scale = size / 128;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + .5) / scale;
      const py = (y + .5) / scale;
      const dx = Math.max(23 - px, px - 105, 0);
      const dy = Math.max(23 - py, py - 105, 0);
      const inside = dx * dx + dy * dy <= 23 * 23;
      let color = [36, 39, 43, inside ? 255 : 0];
      for (const [left, top] of [[27, 66], [54, 32], [81, 48]]) {
        if (px >= left && px <= left + 20 && py >= top && py <= 97) {
          color = py <= top + 3 ? [207, 231, 255, 255] : [50, 139, 222, 255];
        }
      }
      const offset = y * (1 + size * 4) + 1 + x * 4;
      pixels.set(color, offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}

await mkdir(path.join(output, "icons"), { recursive: true });
for (const size of [16, 48, 128]) await writeFile(path.join(output, "icons", `${size}.png`), icon(size));
await cp(path.join(root, "LICENSE"), path.join(output, "LICENSE"));
await cp(path.join(root, "README.md"), path.join(output, "README.md"));
await cp(path.join(root, "assets"), path.join(output, "assets"), { recursive: true });
const tokenizerLicense = await readFile(path.join(root, "node_modules/gpt-tokenizer/LICENSE"), "utf8");
await writeFile(path.join(output, "THIRD_PARTY_NOTICES.txt"), `gpt-tokenizer 3.4.0 (o200k_base)\nhttps://github.com/niieani/gpt-tokenizer\n\n${tokenizerLicense}`);
console.log(`Built: ${output}`);
