/* Shared pure helpers. No credentials or conversation data are persisted. */
(function (root) {
  "use strict";

  const CHANNEL = "chatgpt-limit-tracker/v1";
  const DEFAULTS = Object.freeze({ contextLimit: 0 });
  const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

  function conversationId(pathname) {
    return pathname.match(/\/c\/([a-zA-Z0-9-]+)(?:\/|$)/)?.[1] || null;
  }

  function textParts(content) {
    if (!content || typeof content !== "object") return "";
    if (Array.isArray(content.parts)) {
      return content.parts.map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        return "";
      }).filter(Boolean).join("\n");
    }
    return typeof content.text === "string" ? content.text : "";
  }

  function normalizeConversation(raw, fallbackId) {
    if (!raw || !raw.mapping || typeof raw.mapping !== "object") return null;
    const nodes = [];
    for (const [key, node] of Object.entries(raw.mapping)) {
      if (!node || nodes.length >= 10000) continue;
      const message = node.message;
      const role = message?.author?.role;
      const hidden = message?.metadata?.is_visually_hidden_from_conversation;
      const channel = message?.channel || message?.metadata?.channel;
      const visible = (role === "user" || role === "assistant") && !hidden && channel !== "analysis";
      nodes.push({
        id: key,
        parent: typeof node.parent === "string" ? node.parent : null,
        message: visible ? {
          id: message.id || key,
          role,
          text: textParts(message.content)
        } : null
      });
    }
    return {
      id: raw.conversation_id || raw.id || fallbackId,
      currentNode: raw.current_node || null,
      nodes
    };
  }

  function activeMessages(snapshot, visible = []) {
    if (!snapshot?.nodes?.length) return visible;
    const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
    const byMessage = new Map(snapshot.nodes.filter((node) => node.message).map((node) => [node.message.id, node]));
    let leaf = snapshot.currentNode;

    // A branch switch can happen without re-fetching the conversation. A visible
    // message from a different branch is more current than the server snapshot.
    const defaultPath = new Set();
    for (let node = nodes.get(leaf); node && !defaultPath.has(node.id); node = nodes.get(node.parent)) {
      defaultPath.add(node.id);
    }
    const alternate = [...visible].reverse().map((message) => byMessage.get(message.id))
      .find((node) => node && !defaultPath.has(node.id));
    if (alternate) leaf = alternate.id;

    // A newly regenerated answer is not in the server mapping yet. If live
    // messages follow a known anchor, drop the old branch after that anchor.
    // Otherwise the discarded answer would count alongside its replacement.
    let lastKnown = -1;
    for (let index = 0; index < visible.length; index++) {
      if (byMessage.has(visible[index].id)) lastKnown = index;
    }
    if (lastKnown >= 0 && lastKnown < visible.length - 1) {
      const hasNewMessage = visible.slice(lastKnown + 1).some((message) => !byMessage.has(message.id)
        && !snapshot.nodes.some((node) => node.message?.role === message.role && node.message.text === message.text));
      if (hasNewMessage) leaf = byMessage.get(visible[lastKnown].id).id;
    }

    const chain = [];
    const visited = new Set();
    for (let node = nodes.get(leaf); node && !visited.has(node.id); node = nodes.get(node.parent)) {
      visited.add(node.id);
      if (node.message?.text) chain.push(node.message);
    }
    chain.reverse();
    const positions = new Map(chain.map((message, index) => [message.id, index]));
    for (const message of visible) {
      const index = positions.get(message.id);
      if (index !== undefined) {
        // Prefer the live DOM for a growing response; retain longer API text for
        // collapsed code blocks or other partially rendered content.
        if (message.text.length >= chain[index].text.length) chain[index] = message;
      } else if (!chain.some((item) => item.role === message.role && item.text === message.text)) {
        positions.set(message.id, chain.length);
        chain.push(message);
      }
    }
    return chain;
  }

  function resetTime(raw, now) {
    if (isNumber(raw.reset_at) && raw.reset_at > 0) {
      return raw.reset_at < 1e12 ? raw.reset_at * 1000 : raw.reset_at;
    }
    if (typeof raw.reset_at === "string") {
      const parsed = Date.parse(raw.reset_at);
      if (Number.isFinite(parsed)) return parsed;
    }
    if (isNumber(raw.reset_after_seconds) && raw.reset_after_seconds >= 0) {
      return now + raw.reset_after_seconds * 1000;
    }
    return null;
  }

  function normalizeWindow(raw, id, now) {
    if (!raw || typeof raw !== "object") return null;
    const used = isNumber(raw.used_percent) && raw.used_percent >= 0 ? raw.used_percent : null;
    const resetAt = resetTime(raw, now);
    if (used === null && resetAt === null) return null;
    const seconds = isNumber(raw.limit_window_seconds) ? raw.limit_window_seconds : null;
    const label = seconds === 18000 ? "Сессия · 5 ч" : seconds === 604800 ? "Неделя"
      : seconds ? `Окно · ${formatDuration(seconds * 1000)}`
        : id === "primary" ? "Основное окно" : "Второе окно";
    return { id, label, used, resetAt, seconds };
  }

  function normalizeUsage(raw, now = Date.now()) {
    if (!raw?.rate_limit || typeof raw.rate_limit !== "object") return null;
    const windows = [
      normalizeWindow(raw.rate_limit.primary_window, "primary", now),
      normalizeWindow(raw.rate_limit.secondary_window, "secondary", now)
    ].filter(Boolean);
    if (!windows.length) return null;
    return {
      source: "Work / Codex",
      plan: typeof raw.plan_type === "string" ? raw.plan_type : null,
      windows,
      fetchedAt: now
    };
  }

  function formatDuration(ms) {
    if (!isNumber(ms) || ms <= 0) return "0 мин";
    const minutes = Math.ceil(ms / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    if (days) return `${days} д ${hours} ч`;
    if (hours) return `${hours} ч ${minutes % 60} мин`;
    return `${minutes} мин`;
  }

  function sanitizeSettings(raw) {
    const value = Number(raw?.contextLimit);
    return { contextLimit: Number.isInteger(value) && value >= 1024 && value <= 10000000 ? value : 0 };
  }

  const api = { CHANNEL, DEFAULTS, conversationId, textParts, normalizeConversation,
    activeMessages, resetTime, normalizeWindow, normalizeUsage, formatDuration, sanitizeSettings };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.defineProperty(root, "CLTCore", { value: Object.freeze(api), configurable: true });
})(globalThis);
