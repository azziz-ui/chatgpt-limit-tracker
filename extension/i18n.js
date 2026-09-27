/* UI text only; no account data or locale is stored. */
(function (root) {
  "use strict";

  const messages = {
    en: {
      popupForChatGPT: "for ChatGPT",
      popupTokensTitle: "Conversation tokens",
      popupTokensBody: "The counter above the chat estimates text tokens in the current conversation branch. Hidden instructions, reasoning, and attachments are excluded.",
      popupTokensHint: "By default, only the number is shown: ChatGPT does not provide a reliable context size for the bar.",
      popupAdvanced: "Advanced · reference bar",
      popupContextLabel: "Enter context size manually",
      popupNoBar: "No bar",
      popupTokenUnit: "tokens",
      popupContextHelp: "Only use this if you know the size for your plan and mode. An API model's context window may differ from ChatGPT's. Leave blank to hide the bar.",
      popupSave: "Save",
      popupUsageTitle: "Usage below the composer",
      popupUsageBody: "Server-reported usage and reset times for the shared Work / Codex allowance. These are not the separate limits for regular Chat.",
      popupRefresh: "Refresh usage on this tab",
      popupFooter: "Processed locally · no API key required",
      popupInvalid: "Enter a whole number from 1,024 to 10,000,000.",
      popupSavedBar: "Reference bar saved.",
      popupSavedTokens: "Saved: token count only.",
      popupRefreshing: "Refreshing usage on the ChatGPT tab.",
      popupOpenChatGPT: "Open chatgpt.com and reload the page.",
      usageAria: "Work / Codex usage",
      sourceTitle: "Shared Work / Codex allowance from ChatGPT. This is not the message limit for regular Chat.",
      refresh: "Refresh usage",
      tokensDescription: "Approximate text token count for the current conversation branch (o200k_base).",
      tokensHistory: "History loaded from ChatGPT; the current response updates from the page.",
      tokensVisible: "Only messages currently loaded on the page are counted.",
      tokensLimitations: "Excludes hidden instructions, reasoning, and file/image contents. This is not the model's actual context usage.",
      tokensReference: "Bar uses your manually entered reference: {count} tokens.",
      tokensNoReference: "To show a reference bar, enter a context size in the extension settings.",
      signIn: "Sign in to ChatGPT and press ↻",
      forbidden: "ChatGPT denied access to usage",
      rateLimited: "Too many requests — try again later",
      unsupported: "ChatGPT did not provide quota data",
      loadFailed: "Could not load usage · press ↻",
      loading: "Loading usage…",
      noData: "Usage: no data",
      resetUnknown: "reset unknown",
      awaitingReset: "awaiting reset",
      resetsIn: "resets in {duration}",
      usedAria: "{label}: used",
      percentageUnknown: "Percentage not provided",
      percentageUsed: "{percent}% used",
      windowTitle: "{value}. Shared Work / Codex allowance.",
      resetsAt: "Resets: {time}",
      refreshing: "refreshing…",
      staleError: "stale data · refresh failed",
      waitingForReset: "waiting for updated data",
      stale: "stale data · press ↻",
      upToDate: "used · ChatGPT data",
      lastUpdated: "Last updated: {time}",
      session: "Session · 5h",
      weekly: "Weekly",
      window: "Window · {duration}",
      primaryWindow: "Primary window",
      secondaryWindow: "Secondary window"
    },
    ru: {
      popupForChatGPT: "для ChatGPT",
      popupTokensTitle: "Токены беседы",
      popupTokensBody: "Счётчик над чатом оценивает число токенов текста в текущей ветке беседы. Скрытые инструкции, рассуждения и вложения не учитываются.",
      popupTokensHint: "По умолчанию показано только число: ChatGPT не сообщает достоверный размер контекста для шкалы.",
      popupAdvanced: "Дополнительно · шкала",
      popupContextLabel: "Размер контекста вручную",
      popupNoBar: "Без шкалы",
      popupTokenUnit: "токенов",
      popupContextHelp: "Указывайте размер, только если точно знаете его для своего тарифа и режима. Окно модели в API может отличаться от доступного в ChatGPT. Пустое поле скрывает шкалу.",
      popupSave: "Сохранить",
      popupUsageTitle: "Использование под полем ввода",
      popupUsageBody: "Полученные от сервера проценты и время сброса общей квоты Work / Codex. Отдельные лимиты обычного Chat здесь не отображаются.",
      popupRefresh: "Обновить данные на вкладке",
      popupFooter: "Локальная обработка · без API-ключа",
      popupInvalid: "Введите целое число от 1 024 до 10 000 000.",
      popupSavedBar: "Настройка шкалы сохранена.",
      popupSavedTokens: "Сохранено: только счётчик токенов.",
      popupRefreshing: "Обновляем данные на вкладке ChatGPT.",
      popupOpenChatGPT: "Откройте chatgpt.com и перезагрузите страницу.",
      usageAria: "Использование Work / Codex",
      sourceTitle: "Общая квота Work / Codex из ChatGPT. Это не лимит сообщений обычного Chat.",
      refresh: "Обновить данные",
      tokensDescription: "Приблизительное число токенов текста текущей ветки беседы (o200k_base).",
      tokensHistory: "История получена из ChatGPT; текущий ответ обновляется со страницы.",
      tokensVisible: "Сейчас считаются только сообщения, загруженные на странице.",
      tokensLimitations: "Не включены скрытые инструкции, рассуждения и содержимое файлов или изображений. Это не фактическое заполнение контекста модели.",
      tokensReference: "Шкала относительно заданного вами размера: {count} токенов.",
      tokensNoReference: "Чтобы показать шкалу, укажите размер контекста в настройках расширения.",
      signIn: "Войдите в ChatGPT и нажмите ↻",
      forbidden: "ChatGPT не разрешил доступ к данным об использовании",
      rateLimited: "Слишком много запросов — попробуйте позже",
      unsupported: "ChatGPT не передал данные квоты",
      loadFailed: "Не удалось загрузить данные · нажмите ↻",
      loading: "Загрузка данных…",
      noData: "Использование: нет данных",
      resetUnknown: "сброс неизвестен",
      awaitingReset: "ожидаем сброс",
      resetsIn: "сброс через {duration}",
      usedAria: "{label}: использовано",
      percentageUnknown: "Процент не передан",
      percentageUsed: "Использовано {percent}%",
      windowTitle: "{value}. Общая квота Work / Codex.",
      resetsAt: "Сброс: {time}",
      refreshing: "обновление…",
      staleError: "устаревшие данные · ошибка обновления",
      waitingForReset: "ожидаем данные после сброса",
      stale: "данные устарели · нажмите ↻",
      upToDate: "использовано · данные ChatGPT",
      lastUpdated: "Обновлено: {time}",
      session: "Сессия · 5 ч",
      weekly: "Неделя",
      window: "Окно · {duration}",
      primaryWindow: "Основное окно",
      secondaryWindow: "Второе окно"
    }
  };

  function resolve(pageLang, browserLang) {
    const page = typeof pageLang === "string" ? pageLang.trim() : "";
    const browser = typeof browserLang === "string" ? browserLang.trim() : "";
    const candidate = page || browser;
    return /^ru(?:-|$)/i.test(candidate) ? "ru" : "en";
  }

  function t(locale, key, params = {}) {
    const template = (messages[locale] || messages.en)[key];
    if (typeof template !== "string") throw new Error(`Unknown UI string: ${key}`);
    return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
  }

  function formatDuration(ms, locale) {
    if (!Number.isFinite(ms) || ms <= 0) return locale === "ru" ? "0 мин" : "0m";
    const minutes = Math.ceil(ms / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    if (locale === "ru") {
      if (days) return `${days} д ${hours} ч`;
      if (hours) return `${hours} ч ${minutes % 60} мин`;
      return `${minutes} мин`;
    }
    if (days) return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  function windowLabel(window, locale) {
    if (window.seconds === 18000) return t(locale, "session");
    if (window.seconds === 604800) return t(locale, "weekly");
    if (window.seconds) return t(locale, "window", { duration: formatDuration(window.seconds * 1000, locale) });
    return t(locale, window.id === "primary" ? "primaryWindow" : "secondaryWindow");
  }

  function tokenCount(value, locale) {
    const count = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(value);
    if (locale !== "ru") return `≈ ${count} ${value === 1 ? "token" : "tokens"}`;
    const last = value % 10;
    const lastTwo = value % 100;
    const word = lastTwo >= 11 && lastTwo <= 14 ? "токенов"
      : last === 1 ? "токен" : last >= 2 && last <= 4 ? "токена" : "токенов";
    return `≈ ${count} ${word}`;
  }

  const api = Object.freeze({ resolve, t, formatDuration, windowLabel, tokenCount,
    localeTag: (locale) => locale === "ru" ? "ru-RU" : "en-US" });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.defineProperty(root, "CLTI18n", { value: api, configurable: true });
})(globalThis);
