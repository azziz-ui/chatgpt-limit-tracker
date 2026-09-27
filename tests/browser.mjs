import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { readFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extension = path.join(root, "dist/chatgpt-limit-tracker");
const artifacts = path.join(root, "artifacts");
await mkdir(artifacts, { recursive: true });
const tempRoot = process.platform === "win32" ? path.join(os.tmpdir(), "opencode") : os.tmpdir();
await mkdir(tempRoot, { recursive: true });
const profile = await mkdtemp(path.join(tempRoot, "clt-browser-"));
const fixture = await readFile(path.join(root, "tests/fixture.html"), "utf8");
const executablePath = process.env.CLT_CHROMIUM || chromium.executablePath();
if (!existsSync(executablePath)) throw new Error("Install Chromium with npx playwright install chromium, or set CLT_CHROMIUM.");
const browser = await chromium.launchPersistentContext(profile, {
  executablePath,
  channel: "chromium",
  headless: true,
  viewport: { width: 1440, height: 1000 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
});
const errors = [];
const requests = [];
let mode = "ok";
let percentage = 22.8;
let nextUsageDelay = 0;

function makeNode(id, parent, role, text) {
  return { parent, message: { id, author: { role }, content: { parts: [text] } } };
}

await browser.route("https://chatgpt.com/**", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  requests.push({ path: url.pathname, headers: request.headers() });
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (url.pathname === "/api/auth/session") return json({ accessToken: "test-only-token" });
  if (url.pathname === "/backend-api/wham/usage") {
    const value = percentage;
    if (nextUsageDelay) {
      const delay = nextUsageDelay;
      nextUsageDelay = 0;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (mode === "forbidden") return json({ error: "forbidden" }, 403);
    if (mode === "unsupported") return json({ rate_limit: {} });
    return json({ plan_type: "plus", rate_limit: {
      primary_window: { used_percent: value, limit_window_seconds: 18000, reset_after_seconds: 16980 },
      secondary_window: { used_percent: 78.5, limit_window_seconds: 604800, reset_after_seconds: 162000 }
    } });
  }
  if (url.pathname === "/backend-api/conversation/demo") return json({ conversation_id: "demo", current_node: "a1", mapping: {
    history: makeNode("history", null, "user", "Earlier in this conversation we discussed React state, effects, and event handling. ".repeat(800)),
    u1: makeNode("u1", "history", "user", "Why does useEffect run twice?"),
    a1: makeNode("a1", "u1", "assistant", "Most likely, React Strict Mode is enabled.")
  } });
  if (url.pathname === "/backend-api/conversation/second") return json({ conversation_id: "second", current_node: "u2", mapping: {
    u2: makeNode("u2", null, "user", "hello")
  } });
  if (url.pathname.startsWith("/backend-api/")) return json({});
  if (request.resourceType() === "document") return route.fulfill({ contentType: "text/html", body: fixture });
  return route.fulfill({ status: 404, body: "" });
});

try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("https://chatgpt.com/c/demo");
  await page.waitForFunction(() => document.querySelector("#clt-usage")?.shadowRoot.textContent.includes("22.8%"));
  await page.waitForFunction(() => document.querySelector("#clt-tokens")?.shadowRoot.querySelector(".tokens")?.title.includes("History loaded"));
  assert.equal(await page.locator("#clt-usage").count(), 1);
  assert.equal(await page.locator("#clt-tokens").count(), 1);
  assert.equal(await page.locator("form #clt-usage").count(), 1);
  assert.equal(await page.locator("#page-header #clt-tokens").count(), 1);
  const initialTokens = await page.locator("#clt-tokens .tokens").innerText();
  assert.ok(initialTokens.includes("tokens"));
  assert.ok(requests.find((request) => request.path === "/backend-api/wham/usage").headers.authorization === "Bearer test-only-token");
  console.log("PASS: actual MV3 injection, authenticated usage, full history and header/composer placement");

  // Obtain the extension ID from Chromium's extensions manager, then exercise
  // the real popup and storage-to-content-script change propagation.
  const manager = await browser.newPage();
  await manager.goto("chrome://extensions/");
  const extensionId = await manager.evaluate(() => {
    const root = document.querySelector("extensions-manager").shadowRoot;
    return [...root.querySelector("extensions-item-list").shadowRoot.querySelectorAll("extensions-item")]
      .find((item) => item.data.name === "ChatGPT Limit Tracker")?.data.id;
  });
  assert.ok(extensionId, "Extension is installed");
  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  assert.equal(await popup.locator("details").evaluate((details) => details.open), false);
  await popup.locator("summary").click();
  await popup.locator("#context-limit").fill("128000");
  await popup.locator("#save").click();
  await page.waitForFunction(() => document.querySelector("#clt-tokens").shadowRoot.querySelector(".token-track").hidden === false);
  const storage = await popup.evaluate(() => chrome.storage.local.get(null));
  assert.deepEqual(Object.keys(storage), ["settings"]);
  assert.deepEqual(storage.settings, { contextLimit: 128000 });
  await popup.locator("#context-limit").fill("");
  await popup.locator("#save").click();
  await page.waitForFunction(() => document.querySelector("#clt-tokens").shadowRoot.querySelector(".token-track").hidden === true);
  console.log("PASS: popup settings; storage contains no messages, auth or usage");

  await page.evaluate(() => { document.documentElement.lang = "ru-RU"; });
  await page.waitForFunction(() => document.querySelector("#clt-usage")?.shadowRoot.textContent.includes("Сессия · 5 ч"));
  assert.ok((await page.locator("#clt-tokens .tokens").innerText()).includes("токенов"));
  assert.ok((await page.locator("#clt-usage .windows").innerText()).includes("22,8%"));
  assert.equal(await page.locator("#clt-usage .refresh").getAttribute("aria-label"), "Обновить данные");
  await page.bringToFront();
  await popup.reload();
  await popup.waitForFunction(() => document.documentElement.lang === "ru");
  assert.equal(await popup.locator("[data-i18n=popupTokensTitle]").innerText(), "Токены беседы");
  assert.equal(await popup.locator("#context-limit").getAttribute("placeholder"), "Без шкалы");
  await page.evaluate(() => { document.documentElement.removeAttribute("lang"); });
  const browserLocale = await page.evaluate(() => /^ru(?:-|$)/i.test(navigator.languages?.[0] || navigator.language) ? "ru" : "en");
  await page.waitForFunction((locale) => document.querySelector("#clt-usage")?.shadowRoot.textContent
    .includes(locale === "ru" ? "Сессия · 5 ч" : "Session · 5h"), browserLocale);
  await page.evaluate(() => { document.documentElement.lang = "en-US"; });
  await page.waitForFunction(() => document.querySelector("#clt-usage")?.shadowRoot.textContent.includes("Session · 5h"));
  await page.bringToFront();
  await popup.reload();
  await popup.waitForFunction(() => document.documentElement.lang === "en");
  assert.equal(await popup.locator("[data-i18n=popupTokensTitle]").innerText(), "Conversation tokens");
  console.log("PASS: ChatGPT page language changes update both widgets and popup without a reload");
  await popup.close();
  await manager.close();
  await page.screenshot({ path: path.join(artifacts, "preview-dark.png") });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.waitForFunction(() => !document.getElementById("clt-usage").hasAttribute("data-dark"));
  await page.screenshot({ path: path.join(artifacts, "preview-light.png") });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(artifacts, "preview-mobile.png") });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "No horizontal overflow on narrow screens");
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log("PASS: dark/light themes and 390px viewport");

  await page.evaluate(() => {
    document.querySelector('[data-message-id="a1"] .markdown').append(" Additional answer ".repeat(200));
  });
  await page.waitForFunction((before) => document.querySelector("#clt-tokens").shadowRoot.querySelector(".tokens").innerText !== before, initialTokens);
  console.log("PASS: live response updates token count");

  await page.evaluate(() => {
    document.querySelector("main").innerHTML = '<div data-message-author-role="user" data-message-id="u2">hello</div>';
    history.pushState({}, "", "/g/g-test/c/second");
  });
  await page.waitForFunction(() => document.querySelector("#clt-tokens").shadowRoot.querySelector(".tokens").innerText.includes("≈ 1 token"));
  assert.equal(await page.locator("#clt-tokens").count(), 1);
  console.log("PASS: SPA navigation clears previous conversation and counts new branch");

  await page.evaluate(() => {
    const form = document.querySelector("form");
    const replacement = form.cloneNode(true);
    replacement.querySelector("#clt-usage")?.remove();
    form.replaceWith(replacement);
  });
  await page.waitForFunction(() => document.querySelector("form #clt-usage")?.shadowRoot);
  assert.equal(await page.locator("#clt-usage").count(), 1);
  console.log("PASS: React-style composer replacement remounts exactly one widget");

  await page.waitForTimeout(5100);
  mode = "forbidden";
  await page.locator("#clt-usage .refresh").click();
  await page.waitForFunction(() => document.querySelector("#clt-usage").shadowRoot.textContent.includes("stale data"));
  assert.ok((await page.locator("#clt-usage .windows").innerText()).includes("22.8%"));
  console.log("PASS: API errors preserve explicitly stale readings");

  mode = "ok";
  percentage = 10;
  await page.evaluate(() => fetch("/backend-api/models", { headers: { Authorization: "Bearer workspace-b", "ChatGPT-Account-Id": "workspace-b" } }));
  await page.waitForFunction(() => document.querySelector("#clt-usage").shadowRoot.querySelector(".percent")?.textContent === "10%");
  assert.ok(requests.filter((request) => request.path === "/backend-api/wham/usage").at(-1).headers["chatgpt-account-id"] === "workspace-b");
  console.log("PASS: workspace switching uses correct account headers and clears old quota");

  // A delayed response from workspace B must not overwrite newer workspace C.
  await page.waitForTimeout(5100);
  nextUsageDelay = 1800;
  await page.locator("#clt-usage .refresh").click();
  await page.waitForTimeout(200);
  percentage = 55;
  await page.evaluate(() => fetch("/backend-api/models", { headers: { Authorization: "Bearer workspace-c", "ChatGPT-Account-Id": "workspace-c" } }));
  await page.waitForFunction(() => document.querySelector("#clt-usage").shadowRoot.querySelector(".percent")?.textContent === "55%");
  await page.waitForTimeout(2000);
  assert.equal(await page.locator("#clt-usage .percent").first().innerText(), "55%");
  console.log("PASS: delayed responses from previous workspace cannot overwrite new data");

  mode = "unsupported";
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#clt-usage")?.shadowRoot.textContent.includes("did not provide quota data"));
  assert.equal(await page.locator("#clt-usage .percent").count(), 0);
  console.log("PASS: unsupported API shows no fabricated percentage");
  assert.deepEqual(errors, []);
  console.log("All browser checks passed. Screenshots: artifacts/preview-{dark,light,mobile}.png");
} finally {
  await browser.close();
  await rm(profile, { recursive: true, force: true });
}
