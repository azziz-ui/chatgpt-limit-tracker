(() => {
  "use strict";
  const core = globalThis.CLTCore;
  const i18n = globalThis.CLTI18n;
  if (!core || !i18n || document.getElementById("clt-tokens")) return;

  const browserLanguage = navigator.languages?.[0] || navigator.language;

  const state = {
    settings: { ...core.DEFAULTS },
    locale: i18n.resolve(document.documentElement.lang, browserLanguage),
    route: location.pathname,
    epoch: -1,
    snapshot: null,
    usage: null,
    status: "loading",
    error: "",
    tokens: 0,
    source: "dom",
    streaming: false
  };
  const countCache = new Map();
  const tr = (key, params) => i18n.t(state.locale, key, params);
  const formatNumber = (value) => new Intl.NumberFormat(i18n.localeTag(state.locale)).format(value);
  let scheduled = false;
  let lastResetRefresh = 0;
  let lastGenerationRefresh = 0;

  const send = (type) => window.postMessage({ channel: core.CHANNEL, direction: "to-page", type }, location.origin);
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  const css = `
    :host { color-scheme: light dark; font: 12px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      --muted:#6b6b6b; --text:#303030; --track:rgba(0,0,0,.08); --border:rgba(0,0,0,.2); --accent:#328bde;
      color:var(--muted); box-sizing:border-box; }
    :host([data-dark]) { --muted:#aaa9a4; --text:#ecebe7; --track:rgba(255,255,255,.05); --border:rgba(255,255,255,.32); }
    * { box-sizing:border-box; }
    button { font:inherit; color:inherit; cursor:pointer; }
    button:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
    .tokens { display:inline-flex; align-items:center; gap:9px; padding:4px 0; white-space:nowrap; font-size:13px; }
    .glyph { display:flex; width:14px; height:14px; align-items:end; gap:2px; opacity:.8; }
    .glyph i { display:block; width:3px; border-radius:1px; background:var(--accent); }
    .glyph i:nth-child(1) { height:6px; } .glyph i:nth-child(2) { height:12px; } .glyph i:nth-child(3) { height:9px; }
    .tokens strong { font-weight:500; color:var(--text); }
    .track { display:block; position:relative; height:9px; min-width:48px; overflow:hidden; border:1px solid var(--border);
      border-radius:3px; background:var(--track); }
    .token-track { width:72px; height:7px; }
    .fill { display:block; height:100%; width:0; background:var(--accent); transition:width .35s ease; }
    .fill.warn { background:#d49a37; } .fill.danger { background:#d86861; }
    .fill:not(.empty)::after { content:""; display:block; width:2px; height:100%; margin-left:auto; background:rgba(255,255,255,.8); }
    .usage { padding:10px 0 1px; }
    .windows { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:10px 20px; }
    .windows.single { grid-template-columns:1fr; }
    .window { min-width:0; }
    .line { display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:5px; }
    .label { white-space:nowrap; } .reset { font-size:11px; text-align:right; }
    .percent { color:var(--text); font-weight:500; }
    .footer { display:flex; gap:8px; align-items:center; min-height:22px; margin-top:5px; font-size:10px; }
    .source { letter-spacing:.02em; } .dot { width:4px; height:4px; border-radius:50%; background:var(--accent); flex-shrink:0; }
    .status { flex:1; opacity:.8; }
    .refresh { display:flex; align-items:center; justify-content:center; width:24px; height:23px; padding:0;
      border:0; border-radius:5px; background:transparent; font-size:17px; }
    .refresh:hover { background:var(--track); color:var(--text); }
    .refresh:disabled { cursor:default; opacity:.4; }
    .empty-state { padding:1px 0; }
    .unknown { background:repeating-linear-gradient(120deg,transparent,transparent 5px,var(--track) 5px,var(--track) 10px); }
    [hidden] { display:none!important; }
    @media (max-width:560px) { .tokens { font-size:11px; gap:6px; } .token-track { width:40px; }
      .windows { gap:12px; } .line { display:block; } .reset { display:block; text-align:left; font-size:10px; }
      .label { font-size:11px; } .usage { padding-top:8px; } }
    @media (prefers-reduced-motion:reduce) { .fill { transition:none; } }
  `;

  function widget(id) {
    const host = element("div");
    host.id = id;
    const root = host.attachShadow({ mode: "open" });
    root.append(element("style", "", css));
    return { host, root };
  }

  const tokens = widget("clt-tokens");
  tokens.host.style.cssText = "display:block;flex:0 1 auto;min-width:0;margin:0 12px;max-width:48vw;z-index:20;";
  const tokenRow = element("div", "tokens");
  const glyph = element("span", "glyph");
  glyph.setAttribute("aria-hidden", "true");
  glyph.append(element("i"), element("i"), element("i"));
  const tokenLabel = element("span");
  const tokenTrack = element("span", "track token-track");
  const tokenFill = element("span", "fill");
  tokenTrack.append(tokenFill);
  tokenRow.append(glyph, tokenLabel, tokenTrack);
  tokens.root.append(tokenRow);

  const usage = widget("clt-usage");
  usage.host.style.cssText = "display:block;width:100%;flex:0 0 100%;grid-column:1/-1;padding:0 14px 5px;box-sizing:border-box;";
  const usageBox = element("section", "usage");
  usageBox.setAttribute("aria-label", tr("usageAria"));
  const windows = element("div", "windows");
  const emptyState = element("div", "empty-state");
  const footer = element("div", "footer");
  const source = element("span", "source", "Work / Codex");
  source.title = tr("sourceTitle");
  const dot = element("span", "dot");
  const statusLabel = element("span", "status");
  const refresh = element("button", "refresh", "↻");
  refresh.type = "button";
  refresh.title = tr("refresh");
  refresh.setAttribute("aria-label", tr("refresh"));
  refresh.addEventListener("click", () => send("refresh"));
  footer.append(source, dot, statusLabel, refresh);
  usageBox.append(windows, emptyState, footer);
  usage.root.append(usageBox);

  function mount() {
    const header = document.querySelector('#page-header, [data-testid="conversation-header"], main header, header');
    if (header && tokens.host.parentElement !== header) {
      // Insert after the model selector's top-level header child, before share
      // and account actions. Never wrap or replace React-owned elements.
      let anchor = header.querySelector('[data-testid="model-switcher-dropdown-button"]');
      while (anchor?.parentElement && anchor.parentElement !== header) anchor = anchor.parentElement;
      header.insertBefore(tokens.host, anchor ? anchor.nextSibling : header.lastElementChild);
      tokens.host.style.position = "static";
    } else if (!header && !tokens.host.isConnected && document.body) {
      document.body.append(tokens.host);
      Object.assign(tokens.host.style, { position: "fixed", top: "10px", right: "76px" });
    }

    const input = document.querySelector('#prompt-textarea, [data-testid="prompt-textarea"], textarea[data-id="root"]');
    tokens.host.style.display = input || document.querySelector("[data-message-author-role]") ? "block" : "none";
    const container = input?.closest("form") || input?.closest('[data-composer-surface], [data-testid="composer"]');
    if (container && usage.host.parentElement !== container) container.append(usage.host);
    if (!container && usage.host.isConnected) usage.host.remove();
    const dark = document.documentElement.classList.contains("dark") || document.documentElement.dataset.theme === "dark"
      || document.documentElement.style.colorScheme === "dark";
    tokens.host.toggleAttribute("data-dark", dark);
    usage.host.toggleAttribute("data-dark", dark);
  }

  function domMessages() {
    return [...document.querySelectorAll('[data-message-author-role="user"], [data-message-author-role="assistant"]')]
      .filter((node) => node.getClientRects().length > 0)
      .map((node, index) => {
        const body = node.querySelector(".markdown, .whitespace-pre-wrap") || node;
        return {
          id: node.dataset.messageId || node.closest("[data-message-id]")?.dataset.messageId || `dom-${index}`,
          role: node.dataset.messageAuthorRole,
          text: body.innerText || body.textContent || ""
        };
      }).filter((message) => message.text.trim());
  }

  function countConversation() {
    const visible = domMessages();
    const messages = core.activeMessages(state.snapshot, visible);
    state.source = state.snapshot ? "api" : "dom";
    const usedKeys = new Set();
    let total = 0;
    for (const message of messages) {
      usedKeys.add(message.id);
      let cached = countCache.get(message.id);
      if (!cached || cached.text !== message.text) {
        try {
          cached = { text: message.text, count: globalThis.CLTTokenizer.count(message.text) };
        } catch {
          cached = { text: message.text, count: Math.ceil(new TextEncoder().encode(message.text).length / 3) };
          state.source = "estimate";
        }
        countCache.set(message.id, cached);
      }
      total += cached.count;
    }
    for (const key of countCache.keys()) if (!usedKeys.has(key)) countCache.delete(key);
    state.tokens = total;
    renderTokens();
  }

  function setFill(fill, value) {
    fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
    fill.className = `fill${value >= 90 ? " danger" : value >= 75 ? " warn" : ""}${value <= 0 ? " empty" : ""}`;
  }

  function renderTokens() {
    tokenLabel.textContent = i18n.tokenCount(state.tokens, state.locale);
    const limit = state.settings.contextLimit;
    tokenTrack.hidden = !limit;
    if (limit) setFill(tokenFill, state.tokens / limit * 100);
    tokenRow.title = [
      tr("tokensDescription"),
      tr(state.source === "api" ? "tokensHistory" : "tokensVisible"),
      tr("tokensLimitations"),
      limit ? tr("tokensReference", { count: formatNumber(limit) }) : tr("tokensNoReference")
    ].join("\n");
  }

  function errorText(code) {
    if (code === "signed-out" || code === "http-401") return tr("signIn");
    if (code === "http-403") return tr("forbidden");
    if (code === "http-429") return tr("rateLimited");
    if (code === "unsupported" || code === "http-404") return tr("unsupported");
    return tr("loadFailed");
  }

  function renderUsage() {
    const data = state.usage;
    const now = Date.now();
    refresh.disabled = state.status === "loading";
    windows.replaceChildren();
    windows.hidden = !data;
    emptyState.hidden = Boolean(data);
    emptyState.textContent = tr(state.status === "loading" ? "loading" : "noData");
    source.textContent = data?.plan ? `Work / Codex · ${data.plan}` : "Work / Codex";
    let expired = false;
    if (data) {
      windows.classList.toggle("single", data.windows.length === 1);
      for (const item of data.windows) {
        const windowBox = element("div", "window");
        const line = element("div", "line");
        const windowLabel = i18n.windowLabel(item, state.locale);
        const label = element("span", "label", `${windowLabel}: `);
        const percent = element("span", "percent", item.used === null ? "—" : `${formatNumber(Math.round(item.used * 10) / 10)}%`);
        label.append(percent);
        const passed = item.resetAt !== null && item.resetAt <= now;
        expired ||= passed;
        const reset = element("span", "reset", item.resetAt === null ? tr("resetUnknown")
          : passed ? tr("awaitingReset") : tr("resetsIn", { duration: i18n.formatDuration(item.resetAt - now, state.locale) }));
        const track = element("span", `track${item.used === null ? " unknown" : ""}`);
        track.setAttribute("role", "progressbar");
        track.setAttribute("aria-label", tr("usedAria", { label: windowLabel }));
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", "100");
        if (item.used !== null) track.setAttribute("aria-valuenow", String(Math.min(100, item.used)));
        const fill = element("span", "fill");
        setFill(fill, item.used ?? 0);
        track.append(fill);
        windowBox.title = tr("windowTitle", { value: item.used === null ? tr("percentageUnknown")
          : tr("percentageUsed", { percent: formatNumber(item.used) }) })
          + (item.resetAt ? `\n${tr("resetsAt", { time: new Date(item.resetAt).toLocaleString(i18n.localeTag(state.locale)) })}` : "");
        line.append(label, reset);
        windowBox.append(line, track);
        windows.append(windowBox);
      }
    }
    const stale = data && now - data.fetchedAt > 180000;
    statusLabel.textContent = state.status === "loading" ? tr("refreshing")
      : state.status === "error" ? (data ? tr("staleError") : errorText(state.error))
        : expired ? tr("waitingForReset") : stale ? tr("stale") : tr("upToDate");
    statusLabel.title = data ? tr("lastUpdated", { time: new Date(data.fetchedAt).toLocaleTimeString(i18n.localeTag(state.locale)) }) : errorText(state.error);
    dot.style.opacity = stale || state.status === "error" ? ".35" : "1";
    if (expired && document.visibilityState === "visible" && now - lastResetRefresh > 60000) {
      lastResetRefresh = now;
      send("refresh");
    }
  }

  function checkRoute() {
    if (state.route !== location.pathname) {
      state.route = location.pathname;
      state.snapshot = null;
      countCache.clear();
      send("route");
    }
  }

  function checkLocale() {
    const locale = i18n.resolve(document.documentElement.lang, browserLanguage);
    if (locale === state.locale) return;
    state.locale = locale;
    usageBox.setAttribute("aria-label", tr("usageAria"));
    source.title = tr("sourceTitle");
    refresh.title = tr("refresh");
    refresh.setAttribute("aria-label", tr("refresh"));
    renderTokens();
    renderUsage();
  }

  function update() {
    scheduled = false;
    checkRoute();
    checkLocale();
    mount();
    countConversation();
    const streaming = Boolean(document.querySelector('[data-testid="stop-button"], [data-testid="stop-generation-button"]'));
    if (state.streaming && !streaming && Date.now() - lastGenerationRefresh > 5000) {
      lastGenerationRefresh = Date.now();
      send("refresh");
    }
    state.streaming = streaming;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      if ("requestIdleCallback" in window) requestIdleCallback(update, { timeout: 1000 });
      else update();
    }, 350);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (data?.channel !== core.CHANNEL || data.direction !== "from-page" || !Number.isInteger(data.epoch)) return;
    checkRoute();
    if (data.epoch < state.epoch) return;
    if (data.type === "scope" || data.epoch > state.epoch) {
      state.epoch = data.epoch;
      state.usage = null;
      state.snapshot = null;
      state.status = "loading";
      countCache.clear();
    }
    if (data.type === "usage" && Array.isArray(data.usage?.windows)) {
      state.usage = data.usage;
      state.status = "ok";
    } else if (data.type === "error") {
      state.status = "error";
      state.error = data.code;
    } else if (data.type === "loading") {
      state.status = "loading";
    } else if (data.type === "conversation" && data.conversation?.id === core.conversationId(location.pathname)) {
      state.snapshot = data.conversation;
    }
    renderUsage();
    schedule();
  });

  chrome.storage.local.get("settings").then(({ settings }) => {
    state.settings = core.sanitizeSettings(settings);
    renderTokens();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      state.settings = core.sanitizeSettings(changes.settings.newValue);
      renderTokens();
    }
  });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === "clt-refresh") { send("refresh"); respond({ ok: true }); }
    if (message.type === "clt-locale") { checkLocale(); respond({ locale: state.locale }); }
  });

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ["class", "data-theme", "data-message-id", "data-testid", "lang"]
  });
  window.addEventListener("popstate", schedule);
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (state.route !== location.pathname) schedule();
    checkLocale();
    renderUsage();
  }, 1000);
  update();
  renderUsage();
  send("ready");
})();
