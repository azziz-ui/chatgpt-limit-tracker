const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const core = require("../extension/core.js");
const i18n = require("../extension/i18n.js");

function node(id, parent, role, text, metadata = {}) {
  return { parent, message: { id, author: { role }, content: { parts: [text] }, metadata } };
}

test("active branch excludes regenerated alternatives and hidden system/analysis messages", () => {
  const snapshot = core.normalizeConversation({ current_node: "b", mapping: {
    root: node("root", null, "system", "secret"),
    user: node("user", "root", "user", "Hello"),
    hidden: node("hidden", "user", "assistant", "reasoning", { channel: "analysis" }),
    a: node("a", "user", "assistant", "Old answer"),
    b: node("b", "hidden", "assistant", "New answer")
  } }, "chat");
  assert.deepEqual(core.activeMessages(snapshot).map((item) => item.text), ["Hello", "New answer"]);
  assert.deepEqual(core.activeMessages(snapshot, [{ id: "a", role: "assistant", text: "Old answer" }]).map((item) => item.text), ["Hello", "Old answer"]);
});

test("partial DOM does not lose history; streaming text replaces the same message", () => {
  const snapshot = core.normalizeConversation({ current_node: "a", mapping: {
    u: node("u", null, "user", "Question"), a: node("a", "u", "assistant", "Answer")
  } }, "chat");
  const messages = core.activeMessages(snapshot, [
    { id: "a", role: "assistant", text: "Answer, continued" },
    { id: "u2", role: "user", text: "Follow-up" }
  ]);
  assert.deepEqual(messages.map((item) => item.text), ["Question", "Answer, continued", "Follow-up"]);
});

test("cyclic or incomplete server mappings terminate and still support DOM fallback", () => {
  const snapshot = core.normalizeConversation({ current_node: "a", mapping: {
    a: node("a", "b", "user", "a"), b: node("b", "a", "assistant", "b")
  } }, "chat");
  assert.equal(core.activeMessages(snapshot).length, 2);
  assert.equal(core.normalizeConversation({}), null);
  assert.equal(core.activeMessages(null, [{ id: "live" }])[0].id, "live");
});

test("a regenerated answer not yet in the API replaces the discarded branch", () => {
  const snapshot = core.normalizeConversation({ current_node: "old", mapping: {
    u: node("u", null, "user", "Question"), old: node("old", "u", "assistant", "Discarded answer")
  } }, "chat");
  const messages = core.activeMessages(snapshot, [
    { id: "u", role: "user", text: "Question" },
    { id: "new", role: "assistant", text: "Regenerated answer" }
  ]);
  assert.deepEqual(messages.map((item) => item.text), ["Question", "Regenerated answer"]);
});

test("multimodal content counts text without image payloads", () => {
  assert.equal(core.textParts({ parts: ["text", { content_type: "image_asset_pointer", asset_pointer: "secret-image" }, { text: "caption" }] }), "text\ncaption");
});

test("usage uses server precision, durations and reset timestamps", () => {
  const now = 1700000000000;
  const usage = core.normalizeUsage({ plan_type: "plus", rate_limit: {
    primary_window: { used_percent: 22.8, limit_window_seconds: 18000, reset_after_seconds: 3600 },
    secondary_window: { used_percent: 78.5, limit_window_seconds: 604800, reset_at: 1700300000 }
  } }, now);
  assert.equal(usage.source, "Work / Codex");
  assert.equal(usage.windows[0].used, 22.8);
  assert.equal(usage.windows[0].resetAt, now + 3600000);
  assert.equal(usage.windows[1].resetAt, 1700300000000);
  assert.equal(usage.windows[1].label, "Weekly");
});

test("missing and malformed usage is unknown rather than 0 or 100 percent", () => {
  assert.equal(core.normalizeUsage({}), null);
  assert.equal(core.normalizeUsage({ rate_limit: {} }), null);
  assert.equal(core.normalizeUsage({ rate_limit: { primary_window: { used_percent: null } } }), null);
  const raw = { rate_limit: { primary_window: { reset_after_seconds: 0 } } };
  assert.equal(core.normalizeUsage(raw, 1000).windows[0].used, null);
  assert.equal(core.normalizeUsage(raw, 1000).windows[0].resetAt, 1000);
  assert.equal(core.normalizeUsage({ rate_limit: { primary_window: { used_percent: 0 } } }).windows[0].used, 0);
});

test("expired windows retain server values; unknown durations are not called five hours", () => {
  const usage = core.normalizeUsage({ rate_limit: {
    primary_window: { used_percent: 95, reset_at: 1000, limit_window_seconds: 86400 },
    secondary_window: { used_percent: 10 }
  } }, 2000000);
  assert.equal(usage.windows[0].used, 95);
  assert.equal(usage.windows[0].label, "Window · 1d 0h");
  assert.equal(usage.windows[1].label, "Secondary window");
});

test("settings reject fabricated or invalid limits; conversation IDs support GPT routes", () => {
  assert.equal(core.sanitizeSettings({ contextLimit: 128000 }).contextLimit, 128000);
  for (const contextLimit of [null, -1, "bad", Infinity, 1e10, 128000.5]) {
    assert.equal(core.sanitizeSettings({ contextLimit }).contextLimit, 0);
  }
  assert.equal(core.conversationId("/g/g-123/c/abc-456"), "abc-456");
  assert.equal(core.conversationId("/"), null);
  assert.equal(core.conversationId("/c/a/../../secret"), "a");
});

test("bundled tokenizer handles English text, emoji, code and literal special-token strings", () => {
  const context = vm.createContext({ TextEncoder, TextDecoder });
  vm.runInContext(fs.readFileSync(require.resolve("../dist/chatgpt-limit-tracker/tokenizer.js"), "utf8"), context);
  for (const input of ["Hello world! 👋", "const x = 42;", "<|endoftext|>"]) {
    const count = context.CLTTokenizer.count(input);
    assert.ok(count > 0 && count <= new TextEncoder().encode(input).length);
  }
  assert.equal(context.CLTTokenizer.count(""), 0);
  assert.equal(context.CLTTokenizer.count("hello"), 1);
});

test("ChatGPT page locale takes priority over browser language", () => {
  assert.equal(i18n.resolve("ru-RU", "en-US"), "ru");
  assert.equal(i18n.resolve("en-GB", "ru-RU"), "en");
  assert.equal(i18n.resolve("", "ru-RU"), "ru");
  assert.equal(i18n.resolve(undefined, "en-US"), "en");
  assert.equal(i18n.resolve("de-DE", "ru-RU"), "en");
});

test("usage labels and countdowns localize without changing server values", () => {
  const usage = core.normalizeUsage({ rate_limit: {
    primary_window: { used_percent: 22.8, limit_window_seconds: 18000, reset_after_seconds: 3600 },
    secondary_window: { used_percent: 78.5, limit_window_seconds: 604800 }
  } }, 1700000000000);
  assert.equal(usage.windows[0].used, 22.8);
  assert.equal(i18n.windowLabel(usage.windows[0], "ru"), "Сессия · 5 ч");
  assert.equal(i18n.windowLabel(usage.windows[1], "en"), "Weekly");
  assert.equal(i18n.formatDuration(16980000, "ru"), "4 ч 43 мин");
  assert.equal(i18n.formatDuration(16980000, "en"), "4h 43m");
  assert.equal(i18n.t("ru", "resetsIn", { duration: "4 ч 43 мин" }), "сброс через 4 ч 43 мин");
  assert.equal(i18n.tokenCount(1, "ru"), "≈ 1 токен");
  assert.equal(i18n.tokenCount(22, "ru"), "≈ 22 токена");
  assert.equal(i18n.tokenCount(11, "ru"), "≈ 11 токенов");
});

test("Chrome extension description has both browser locales", () => {
  for (const locale of ["en", "ru"]) {
    const messages = JSON.parse(fs.readFileSync(require.resolve(`../extension/_locales/${locale}/messages.json`), "utf8"));
    assert.ok(messages.extensionDescription.message.includes("Work / Codex"));
  }
});
