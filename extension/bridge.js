/* Runs in the page world. Authorization stays here and is never sent to UI. */
(() => {
  "use strict";
  const core = globalThis.CLTCore;
  if (!core || window.__cltBridgeInstalled) return;
  Object.defineProperty(window, "__cltBridgeInstalled", { value: true });
  const originalFetch = window.fetch.bind(window);
  let authorization = "";
  let accountId = "";
  let epoch = 0;
  let ready = false;
  let lastAttempt = 0;
  let lastConversationAttempt = "";
  let pending = null;
  let generationTimer;
  let cache = null;
  let sessionPromise = null;
  let scopeTimer;

  const send = (type, payload = {}) => {
    if (ready) window.postMessage({ channel: core.CHANNEL, direction: "from-page", type, epoch, ...payload }, location.origin);
  };

  function changeScope() {
    epoch += 1;
    cache = null;
    pending = null;
    lastAttempt = 0;
    lastConversationAttempt = "";
    sessionPromise = null;
    send("scope");
    clearTimeout(scopeTimer);
    scopeTimer = setTimeout(() => {
      if (ready) { refreshUsage(); refreshConversation(); }
    }, 400);
  }

  async function getAuthorization() {
    if (authorization) return authorization;
    if (!sessionPromise) {
      const scope = epoch;
      sessionPromise = originalFetch("/api/auth/session", {
        credentials: "same-origin", signal: AbortSignal.timeout(12000)
      }).then((response) => response.ok ? response.json() : null).then((session) => {
        if (scope === epoch && typeof session?.accessToken === "string") authorization = `Bearer ${session.accessToken}`;
        return scope === epoch ? authorization : "";
      }).catch(() => "").finally(() => { if (scope === epoch) sessionPromise = null; });
    }
    return sessionPromise;
  }

  async function apiGet(path, scope) {
    const token = await getAuthorization();
    if (scope !== epoch) throw new Error("scope-changed");
    if (!token) throw new Error("signed-out");
    const headers = { Accept: "application/json", Authorization: token };
    if (accountId) headers["ChatGPT-Account-Id"] = accountId;
    const response = await originalFetch(path, {
      headers, credentials: "same-origin", signal: AbortSignal.timeout(15000)
    });
    if (response.status === 401 && scope === epoch) authorization = "";
    if (!response.ok) throw new Error(`http-${response.status}`);
    return response.json();
  }

  function refreshUsage(force = false) {
    if (pending) return pending;
    if (Date.now() - lastAttempt < (force ? 5000 : 60000)) return Promise.resolve();
    const scope = epoch;
    lastAttempt = Date.now();
    send("loading");
    const work = apiGet("/backend-api/wham/usage", scope).then((raw) => {
      if (scope !== epoch) return;
      const usage = core.normalizeUsage(raw);
      if (!usage) throw new Error("unsupported");
      cache = usage;
      send("usage", { usage });
    }).catch((error) => {
      if (scope === epoch) send("error", { code: error.message, usage: cache });
    }).finally(() => { if (scope === epoch) pending = null; });
    pending = work;
    return work;
  }

  async function refreshConversation(force = false) {
    const id = core.conversationId(location.pathname);
    if (!id || (!force && lastConversationAttempt === id)) return;
    lastConversationAttempt = id;
    const scope = epoch;
    try {
      const raw = await apiGet(`/backend-api/conversation/${encodeURIComponent(id)}`, scope);
      if (scope !== epoch || id !== core.conversationId(location.pathname)) return;
      const conversation = core.normalizeConversation(raw, id);
      if (conversation) send("conversation", { conversation });
    } catch {
      // DOM counting remains available for temporary chats, offline mode and
      // accounts without access to the internal conversation endpoint.
      if (scope === epoch) send("conversation-unavailable", { id });
    }
  }

  window.fetch = function (input, init) {
    let url;
    let method = "GET";
    let scope = epoch;
    try {
      url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, location.href);
      method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (url.origin === location.origin && url.pathname.startsWith("/backend-api/")) {
        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
        const token = headers.get("authorization");
        const account = headers.get("chatgpt-account-id");
        if (account !== null && account !== accountId) {
          accountId = account;
          changeScope();
        }
        if (token) authorization = token;
        scope = epoch;
      }
    } catch { /* Preserve the site's native fetch behavior for unfamiliar inputs. */ }

    const result = originalFetch(input, init);
    if (url?.origin !== location.origin) return result;
    const isConversation = /^\/backend-api\/(?:f\/)?conversation\/[a-zA-Z0-9-]+$/.test(url.pathname)
      && !url.pathname.endsWith("/init");
    const isUsage = url.pathname === "/backend-api/wham/usage";
    if (method === "GET" && (isConversation || isUsage)) {
      result.then((response) => {
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
        return response.clone().json().then((raw) => {
          if (scope !== epoch) return;
          if (isUsage) {
            const usage = core.normalizeUsage(raw);
            if (usage) { cache = usage; send("usage", { usage }); }
          } else {
            const conversation = core.normalizeConversation(raw, url.pathname.split("/").pop());
            if (conversation) send("conversation", { conversation });
          }
        });
      }).catch(() => {});
    }
    if (method === "POST" && /^\/backend-api\/(?:f\/)?conversation$/.test(url.pathname)) {
      send("generation");
      clearTimeout(generationTimer);
      generationTimer = setTimeout(() => { if (ready) refreshUsage(true); }, 15000);
    }
    if (url.pathname.includes("/auth/signout")) {
      authorization = "";
      accountId = "";
      changeScope();
    }
    return result;
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (data?.channel !== core.CHANNEL || data.direction !== "to-page") return;
    if (data.type === "ready") {
      ready = true;
      send("scope");
      if (cache) send("usage", { usage: cache });
      refreshUsage();
      refreshConversation();
    } else if (data.type === "refresh") {
      refreshUsage(true);
    } else if (data.type === "route") {
      lastConversationAttempt = "";
      refreshConversation();
    }
  });

  setInterval(() => {
    if (ready && document.visibilityState === "visible") refreshUsage();
  }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (ready && document.visibilityState === "visible") refreshUsage();
  });
})();
