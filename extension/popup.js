"use strict";

const input = document.getElementById("context-limit");
const feedback = document.getElementById("feedback");
const i18n = CLTI18n;
let locale = i18n.resolve("", navigator.languages?.[0] || navigator.language || chrome.i18n.getUILanguage());
const tr = (key) => i18n.t(locale, key);

function applyLocale(nextLocale) {
  locale = nextLocale;
  document.documentElement.lang = locale;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = tr(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    element.placeholder = tr(element.dataset.i18nPlaceholder);
  }
}

applyLocale(locale);
chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
  if (!tab?.id) return;
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: "clt-locale" });
    if (result?.locale === "ru" || result?.locale === "en") applyLocale(result.locale);
  } catch { /* The active tab is not ChatGPT; keep the browser language. */ }
}).catch(() => {});

chrome.storage.local.get("settings").then(({ settings }) => {
  input.value = CLTCore.sanitizeSettings(settings).contextLimit || "";
});

document.getElementById("save").addEventListener("click", async () => {
  if (input.value && !input.checkValidity()) {
    feedback.textContent = tr("popupInvalid");
    input.reportValidity();
    return;
  }
  await chrome.storage.local.set({ settings: CLTCore.sanitizeSettings({ contextLimit: input.value }) });
  feedback.textContent = tr(input.value ? "popupSavedBar" : "popupSavedTokens");
});

document.getElementById("refresh").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { type: "clt-refresh" });
    feedback.textContent = tr("popupRefreshing");
  } catch {
    feedback.textContent = tr("popupOpenChatGPT");
  }
});
