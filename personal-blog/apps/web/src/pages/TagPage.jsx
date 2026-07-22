import { ArrowLeft, ArrowRight, MagnifyingGlass, TagSimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { fetchPosts, fetchSite, fetchTags } from "../api.js";
import { useBodyScrollLock, usePageMeta } from "../app/hooks.js";
import { fallbackSite } from "../shared/site.js";
import { StatusBanner } from "../shared/components/Feedback.jsx";
import { MenuButton, PublicSidebar, SidebarScrim, ThemeButton } from "../shared/components/Navigation.jsx";

export function TagPage({ isDark, navigate, onOpenSearch, setIsDark, tag, user }) {
  const [siteBundle, setSiteBundle] = useState(null);
  const [tagStats, setTagStats] = useState([]);
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const site = siteBundle?.site ?? fallbackSite;

  useBodyScrollLock(isMenuOpen);
  usePageMeta({
    description: tag ? `带有标签「${tag}」的全部文章。` : "按标签浏览全部文章归档。",
    og: { image: "/og-image.png", title: tag ? `${tag} | ${site.brand.title}` : `标签归档 | ${site.brand.title}` },
    title: tag ? `${tag} | ${site.brand.title}` : `标签归档 | ${site.brand.title}`,
  });

  useEffect(() => {
    setPage(1);
  }, [tag]);

  useEffect(() => {
    let ignore = false;
    setStatus("loading");
    const base = fetchSite().then((payload) => {
      if (!ignore) setSiteBundle(payload);
    });
    const content = tag
      ? fetchPosts({ filter: tag, page, pageSize: 12 }).then((payload) => {
          if (!ignore) {
            setPosts(payload.posts || []);
            setPagination(payload.pagination || { page: 1, total: 0, totalPages: 1 });
          }
        })
      : fetchTags().then((payload) => {
          if (!ignore) setTagStats(payload.stats || []);
        });
    Promise.all([base, content])
      .then(() => {
        if (!ignore) setStatus("ready");
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error.message);
          setStatus("error");
        }
      });
    return () => {
      ignore = true;
    };
  }, [tag, page]);

  return (
    <main className={isDark ? "app tags-app app-dark" : "app tags-app"}>
      <a className="skip-link" href="#main-content">跳到标签内容</a>
      <PublicSidebar activeNav="文章库" isOpen={isMenuOpen} navigate={navigate} onClose={() => setIsMenuOpen(false)} setActiveNav={() => undefined} site={site} user={user} />
      <SidebarScrim isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <section className="workspace tags-workspace" id="main-content" tabIndex={-1}>
        <header className="topbar tags-topbar">
          <div className="topbar-leading"><MenuButton onClick={() => setIsMenuOpen(true)} />
            <button className="icon-text-button" onClick={() => navigate(tag ? "/tags" : "/")} type="button"><ArrowLeft size={18} />{tag ? "返回标签" : "返回首页"}</button>
          </div>
          <div className="toolbar"><button aria-label="搜索文章" className="icon-text-button" onClick={onOpenSearch} type="button"><MagnifyingGlass size={18} />搜索</button>
            <ThemeButton isDark={isDark} setIsDark={setIsDark} />
          </div>
        </header>

        <div className="tags-page">
          {status === "loading" && <div className="empty-state"><strong>正在加载标签</strong><p>同步标签与文章数据。</p></div>}
          {status === "error" && <StatusBanner message={errorMessage} title="标签加载失败" />}
          {status === "ready" && !tag && (
            <>
              <header className="tags-header">
                <span className="post-kind">标签归档</span>
                <h1>全部标签</h1>
                <p className="article-excerpt">共 {tagStats.length} 个标签，点击任意标签查看对应文章。</p>
              </header>
              {tagStats.length ? (
                <div className="tag-grid">
                  {tagStats.map((entry) => (
                    <button className="tag-pill" key={entry.name} onClick={() => navigate(`/tags/${encodeURIComponent(entry.name)}`)} type="button">
                      <TagSimple size={17} />
                      <span>{entry.name}</span>
                      <small>{entry.count}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state"><strong>还没有标签</strong><p>发布带标签的文章后，这里会自动汇总。</p></div>
              )}
            </>
          )}
          {status === "ready" && tag && (
            <>
              <header className="tags-header">
                <span className="post-kind">标签</span>
                <h1>{tag}</h1>
                <p className="article-excerpt">共 {pagination.total} 篇带此标签的文章。</p>
              </header>
              {posts.length ? (
                <div className="stack-card featured-list">
                  {posts.map((post) => (
                    <button className="post-row" key={post.id} onClick={() => navigate(`/posts/${encodeURIComponent(post.slug)}`)} type="button">
                      <div className="post-row-meta"><span className="post-kind">{post.kind}</span><span>{post.date}</span><span>{post.readTime}</span></div>
                      <strong>{post.title}</strong><p>{post.excerpt}</p><ArrowRight size={18} />
                    </button>
                  ))}
                  {pagination.totalPages > 1 && (
                    <div className="pagination-bar" aria-label="标签文章分页">
                      <button className="icon-text-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button"><ArrowLeft size={17} />上一页</button>
                      <span>第 {page} / {pagination.totalPages} 页</span>
                      <button className="icon-text-button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} type="button">下一页<ArrowRight size={17} /></button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state"><strong>这个标签下暂无文章</strong><p>换个标签，或回到标签列表看看。</p>
                  <button className="ghost-action" onClick={() => navigate("/tags")} type="button">浏览全部标签</button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
