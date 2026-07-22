export function ArticleToc({ activeId, items, onSelect }) {
  if (!items.length) return null;

  return (
    <nav aria-label="文章目录" className="toc-rail">
      <p className="toc-title">目录</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button
              aria-current={activeId === item.id ? "true" : undefined}
              className={activeId === item.id ? "toc-item is-active" : "toc-item"}
              data-level={item.level}
              onClick={() => onSelect(item.id)}
              type="button"
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
