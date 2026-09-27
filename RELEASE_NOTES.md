# v1.0.3 — Automatic English / Russian UI

The extension now follows the language declared by the ChatGPT page. If ChatGPT does not specify a language, it uses the browser language. English and Russian are supported; other languages fall back to English.

- Token counter, usage bars, reset countdowns, tooltips, accessibility labels, error messages, and popup settings switch together.
- Changing the ChatGPT page language updates the widgets without reloading the page.
- The popup asks the active ChatGPT tab for its language; outside ChatGPT, it falls back to the browser language.
- Usage values and privacy behavior are unchanged.

**Install:** download the attached `chatgpt-limit-tracker-1.0.3.zip`, extract it, and select the inner `chatgpt-limit-tracker` folder in `chrome://extensions` → **Load unpacked** (with **Developer mode** enabled). If updating an unpacked installation, replace the files, click **Reload** in `chrome://extensions`, and reload the ChatGPT tab.

The usage bars track the shared **Work / Codex** allowance, not the separate limits for regular Chat. See the README for details.
