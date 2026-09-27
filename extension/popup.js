"use strict";

const input = document.getElementById("context-limit");
const feedback = document.getElementById("feedback");
chrome.storage.local.get("settings").then(({ settings }) => {
  input.value = CLTCore.sanitizeSettings(settings).contextLimit || "";
});

document.getElementById("save").addEventListener("click", async () => {
  if (input.value && !input.checkValidity()) {
    feedback.textContent = "Enter a whole number from 1,024 to 10,000,000.";
    input.reportValidity();
    return;
  }
  await chrome.storage.local.set({ settings: CLTCore.sanitizeSettings({ contextLimit: input.value }) });
  feedback.textContent = input.value ? "Reference bar saved." : "Saved: token count only.";
});

document.getElementById("refresh").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { type: "clt-refresh" });
    feedback.textContent = "Refreshing usage on the ChatGPT tab.";
  } catch {
    feedback.textContent = "Open chatgpt.com and reload the page.";
  }
});
