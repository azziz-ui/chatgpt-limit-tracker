import { chromium } from "playwright";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executablePath = process.env.CLT_CHROMIUM || chromium.executablePath();
if (!existsSync(executablePath)) throw new Error("Install Chromium with npx playwright install chromium, or set CLT_CHROMIUM.");
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(root, "assets/social-preview.svg")).href);
  await page.locator("svg").screenshot({ path: path.join(root, "assets/social-preview.png") });
  console.log("Rendered: assets/social-preview.png (1200 × 630)");
} finally {
  await browser.close();
}
