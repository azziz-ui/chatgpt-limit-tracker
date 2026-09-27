"use strict";

const input = document.getElementById("context-limit");
const feedback = document.getElementById("feedback");
chrome.storage.local.get("settings").then(({ settings }) => {
  input.value = CLTCore.sanitizeSettings(settings).contextLimit || "";
});

document.getElementById("save").addEventListener("click", async () => {
  if (input.value && !input.checkValidity()) {
    feedback.textContent = "Введите целое число от 1024 до 10 000 000.";
    input.reportValidity();
    return;
  }
  await chrome.storage.local.set({ settings: CLTCore.sanitizeSettings({ contextLimit: input.value }) });
  feedback.textContent = input.value ? "Размер шкалы сохранён." : "Сохранено: только счётчик токенов.";
});

document.getElementById("refresh").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { type: "clt-refresh" });
    feedback.textContent = "Usage обновляется на странице ChatGPT.";
  } catch {
    feedback.textContent = "Откройте chatgpt.com и обновите страницу.";
  }
});
