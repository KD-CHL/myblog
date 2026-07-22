import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "knowledge-log-theme";

export function getInitialTheme() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme === "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

function upsertMeta(attr, key, content) {
  if (!content) return;
  let element = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

export function usePageMeta({ description, og = {}, title }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", og.title || title);
    upsertMeta("property", "og:description", og.description || description);
    upsertMeta("property", "og:type", og.type || "website");
    upsertMeta("property", "og:url", og.url || window.location.href);
    if (og.image) upsertMeta("property", "og:image", og.image);
    if (og.publishedTime) upsertMeta("property", "article:published_time", og.publishedTime);
  }, [description, og, title]);
}

export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [locked]);
}

export function useTransientMessage(message, clear, delay = 3200) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(clear, delay);
    return () => window.clearTimeout(timer);
  }, [clear, delay, message]);
}
