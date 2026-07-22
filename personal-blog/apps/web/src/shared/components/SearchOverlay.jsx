import { MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { fetchPosts } from "../../api.js";
import { useBodyScrollLock } from "../../app/hooks.js";

export function SearchOverlay({ navigate, onClose, open }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);

  useBodyScrollLock(open);

  /* Reset state each time the overlay opens. */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setHighlightIndex(0);
    setIsSearching(false);
    requestIdRef.current += 1;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  /* Debounced search; empty query shows latest posts. */
  useEffect(() => {
    if (!open) return undefined;
    const requestId = ++requestIdRef.current;
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      const trimmed = query.trim();
      const options = trimmed ? { pageSize: 8, query: trimmed } : { pageSize: 8 };
      fetchPosts(options)
        .then((payload) => {
          if (requestId !== requestIdRef.current) return;
          setResults(payload.posts || []);
          setHighlightIndex(0);
          setIsSearching(false);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setResults([]);
          setIsSearching(false);
        });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  function goToPost(post) {
    onClose();
    navigate(`/posts/${encodeURIComponent(post.slug)}`);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((current) => (results.length ? (current + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((current) => (results.length ? (current - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      const target = results[highlightIndex];
      if (target) {
        event.preventDefault();
        goToPost(target);
      }
    }
  }

  if (!open) return null;

  return (
    <div className="search-overlay" onKeyDown={handleKeyDown} role="dialog" aria-modal="true" aria-label="搜索文章">
      <button aria-label="关闭搜索" className="search-overlay-scrim" onClick={onClose} tabIndex={-1} type="button" />
      <div className="search-dialog">
        <div className="search-input-row">
          <MagnifyingGlass size={20} />
          <input
            aria-label="搜索关键词"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索文章标题、摘要或标签…"
            ref={inputRef}
            type="search"
            value={query}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="search-results">
          {isSearching && <p className="search-hint">正在搜索…</p>}
          {!isSearching && results.length === 0 && (
            <p className="search-hint">{query.trim() ? "没有匹配的文章，换个关键词试试。" : "暂无文章。"}</p>
          )}
          {!isSearching && results.length > 0 && (
            <>
              <p className="search-results-label">{query.trim() ? "搜索结果" : "最新内容"}</p>
              <ul>
                {results.map((post, index) => (
                  <li key={post.id}>
                    <button
                      className={index === highlightIndex ? "is-active" : undefined}
                      onClick={() => goToPost(post)}
                      onMouseEnter={() => setHighlightIndex(index)}
                      type="button"
                    >
                      <strong>{post.title}</strong>
                      {post.excerpt && <small>{post.excerpt}</small>}
                      <span className="search-result-meta">{post.date} · {post.readTime}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
