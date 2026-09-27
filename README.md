<div align="center">
  <img src="assets/logo.png" width="76" height="76" alt="ChatGPT Limit Tracker logo: three blue bars">
  <h1>ChatGPT Limit Tracker</h1>
  <p>Conversation tokens above the chat. Work / Codex usage below the composer.</p>
  <img src="assets/banner.svg" width="100%" alt="ChatGPT Limit Tracker banner showing a token counter and usage bars">
</div>

A **Google Chrome extension** (Manifest V3) that adds an approximate token count for your current conversation branch and server-reported usage bars with reset times to [chatgpt.com](https://chatgpt.com/). No API key, analytics, or third-party servers.

> **Important:** The bars below the composer show the shared **ChatGPT Work / Codex** allowance, **not** the message limit for regular Chat. The token count estimates conversation text; it is not an exact measure of the model's context usage.

## Preview

![Demo of the extension in dark mode: tokens in the header and Work / Codex usage under the composer](assets/screenshot-dark.png)

<details>
<summary>Light mode and narrow screen</summary>

| Light mode | Narrow screen |
| --- | --- |
| ![Demo in light mode](assets/screenshot-light.png) | ![Demo on a narrow screen](assets/screenshot-mobile.png) |

</details>

*Screenshots were captured on a test page with simulated API responses. They show the extension's interface, not a real account's usage.*

## Install

1. Download `chatgpt-limit-tracker-1.0.2.zip` from the [latest release](https://github.com/azziz-ui/chatgpt-limit-tracker/releases/latest), or build from source below.
2. Extract the ZIP to a permanent folder. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Click **Load unpacked** and choose the extracted `chatgpt-limit-tracker` folder containing `manifest.json`.
4. Open or reload [chatgpt.com](https://chatgpt.com/).

If you build from source, select `dist/chatgpt-limit-tracker/`. Do not select the source `extension/` folder: it does not contain the bundled tokenizer or generated icons.

## Features and limitations

| Feature | Details |
| --- | --- |
| Token counter | Counts text in the current conversation branch with a locally bundled `gpt-tokenizer` (`o200k_base`). Updates as a response is generated. |
| Conversation history | Reads the current conversation through ChatGPT's internal API. If unavailable, falls back to messages loaded on the page. |
| Usage bars | Show the **used percentage** for the shared **Work / Codex** allowance windows from `/backend-api/wham/usage`, when the server provides them. |
| Reset times | Read from the server. Refreshes once a minute in a visible tab and on demand with `↻`. |
| Appearance | Works in light and dark themes, including narrow screens. |

The context size is **not detected automatically**. It can vary between products, plans, and modes, even for the same API model. The counter therefore shows a number **without a context-fill bar** by default. If you know the exact size for your setup, you can enable an approximate reference bar under Advanced settings. Don't enter a guessed number just to fill the bar.

The token estimate excludes hidden instructions, reasoning, file and image contents, server-side history compaction, and request-formatting overhead. The model's tokenizer may also differ. There is no Claude-style cache timer because ChatGPT does not expose reliable data for one.

If the server does not provide usage, the extension shows **“no data”**, not a made-up percentage. Previously fetched readings are explicitly marked stale after a refresh error. ChatGPT's internal API and page structure can change without notice. Chrome extensions do not run inside the ChatGPT desktop app.

## Privacy

- Scripts run only on `chatgpt.com`; the only extension permission is `storage` for your reference-bar setting.
- Conversations, authentication tokens, and usage are **not saved** to extension storage or sent to third-party servers.
- Requests to ChatGPT's internal API use your current session and stay on `chatgpt.com`. Only the current conversation is requested, not your complete chat list.
- No analytics, remote code, or API-key entry.

## Development

Requires Node.js 20+.

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:browser
npm run package
```

The unpacked extension is built to `dist/chatgpt-limit-tracker/`; the installable archive is `chatgpt-limit-tracker-1.0.2.zip`. Browser tests launch a real MV3 extension in an isolated Chromium profile with a test page and controlled API responses. They do not access your conversations. If Chromium is already installed, set `CLT_CHROMIUM` to its executable path. To regenerate the GitHub preview image, run `npm run assets:social`.

## Publishing

The GitHub release includes the installable ZIP. The logo, banner, demo screenshots, and [GitHub social preview](assets/social-preview.png) are in `assets/`. Upload `assets/social-preview.png` under **Settings → General → Social preview** if you want the repository link to display a custom share card. Build output (`dist/`), test screenshots (`artifacts/`), and dependencies (`node_modules/`) are intentionally ignored by Git.

## License

[MIT](LICENSE). Inspired by [Claude Counter](https://github.com/she-llac/claude-counter); this implementation is separate. The bundled `gpt-tokenizer` license is included as `THIRD_PARTY_NOTICES.txt` in the release archive.
