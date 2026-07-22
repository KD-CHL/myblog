import {
  ArrowLeft,
  ArrowRight,
  BellSimple,
  BookOpen,
  FolderOpen,
  MagnifyingGlass,
  Plus,
  SidebarSimple,
  SlidersHorizontal,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSubscription, fetchPosts, fetchSite, unsubscribe } from "../api.js";
import { useBodyScrollLock, useDebouncedValue, usePageMeta } from "../app/hooks.js";
import { readStoredJson, SUBSCRIPTION_STORAGE_KEY, formatDateTime } from "../shared/content.js";
import { fallbackSite } from "../shared/site.js";
import { Modal, StatusBanner, Toast } from "../shared/components/Feedback.jsx";
import {
  MenuButton,
  PublicSidebar,
  SidebarScrim,
  ThemeButton,
} from "../shared/components/Navigation.jsx";

export function HomePage({ isDark, navigate, setIsDark, user }) {
  const savedSubscription = useMemo(() => readStoredJson(SUBSCRIPTION_STORAGE_KEY), []);
  const [siteBundle, setSiteBundle] = useState(null);
  const [posts, setPosts] = useState([]);
  const [notes, setNotes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [activeNav, setActiveNav] = useState("总览");
  const [activeFilter, setActiveFilter] = useState("全部");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState("latest");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(() => window.innerWidth > 1120);
  const [subscription, setSubscription] = useState(savedSubscription);
  const [subscriptionEmail, setSubscriptionEmail] = useState(savedSubscription?.email || "");
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [siteStatus, setSiteStatus] = useState("loading");
  const [postsStatus, setPostsStatus] = useState("loading");
  const [notesStatus, setNotesStatus] = useState("loading");
  const [subscriptionStatus, setSubscriptionStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const searchInputRef = useRef(null);
  const debouncedQuery = useDebouncedValue(query, 180);
  const site = siteBundle?.site ?? fallbackSite;
  const projects = siteBundle?.projects ?? [];
  const timeline = siteBundle?.timeline ?? [];

  usePageMeta({
    description: site.hero?.description,
    og: { image: "/og-image.png", title: `${site.hero?.title || "个人知识工作台"} | ${site.brand.title}` },
    title: `${site.hero?.title || "个人知识工作台"} | ${site.brand.title}`,
  });

  useBodyScrollLock(isMenuOpen || isSubscriptionOpen || (isFiltersOpen && window.innerWidth <= 1120));

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = window.setTimeout(() => setToastMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    let ignore = false;
    setSiteStatus("loading");
    fetchSite()
      .then((payload) => {
        if (!ignore) {
          setSiteBundle(payload);
          setSiteStatus("ready");
        }
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error.message);
          setSiteStatus("error");
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeFilter, activeNav, debouncedQuery, sortMode]);

  useEffect(() => {
    let ignore = false;
    setPostsStatus("loading");
    fetchPosts({
      filter: activeFilter,
      nav: activeNav === "归档" ? "总览" : activeNav,
      page,
      pageSize: activeNav === "归档" ? 10 : 8,
      query: debouncedQuery,
      sort: sortMode,
    })
      .then((payload) => {
        if (!ignore) {
          setPosts(payload.posts);
          setPagination(payload.pagination);
          setPostsStatus("ready");
        }
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error.message);
          setPostsStatus("error");
        }
      });
    return () => {
      ignore = true;
    };
  }, [activeFilter, activeNav, debouncedQuery, page, sortMode]);

  useEffect(() => {
    let ignore = false;
    fetchPosts({ nav: "技术笔记", pageSize: 3 })
      .then((payload) => {
        if (!ignore) {
          setNotes(payload.posts);
          setNotesStatus("ready");
        }
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error.message);
          setNotesStatus("error");
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function submitSubscription(event) {
    event.preventDefault();
    setSubscriptionStatus("loading");
    setErrorMessage("");
    try {
      const payload = await createSubscription({ email: subscriptionEmail, topic: activeFilter });
      const record = {
        email: payload.subscription.email,
        id: payload.subscription.id,
        token: payload.unsubscribeToken,
        topic: payload.subscription.topic,
      };
      window.localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(record));
      setSubscription(record);
      setIsSubscriptionOpen(false);
      setToastMessage("邮箱已加入更新名单");
      setSubscriptionStatus("idle");
    } catch (error) {
      setErrorMessage(error.message);
      setSubscriptionStatus("error");
    }
  }

  async function cancelSubscription() {
    if (!subscription?.id || !subscription?.token) return;
    setSubscriptionStatus("loading");
    try {
      await unsubscribe(subscription.id, subscription.token);
      window.localStorage.removeItem(SUBSCRIPTION_STORAGE_KEY);
      setSubscription(null);
      setIsSubscriptionOpen(false);
      setToastMessage("已从更新名单中移除");
      setSubscriptionStatus("idle");
    } catch (error) {
      setErrorMessage(error.message);
      setSubscriptionStatus("error");
    }
  }

  return (
    <main className={isDark ? "app app-dark" : "app"}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <PublicSidebar
        activeNav={activeNav}
        isOpen={isMenuOpen}
        navigate={navigate}
        onClose={() => setIsMenuOpen(false)}
        setActiveNav={setActiveNav}
        site={site}
        user={user}
      />
      <SidebarScrim isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <section className="workspace" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="topbar-search-group">
            <MenuButton onClick={() => setIsMenuOpen(true)} />
            <div className="search-box" role="search">
              <MagnifyingGlass size={20} weight="bold" />
              <span>搜索知识库</span>
              <input
                aria-label="搜索知识库"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="按标题、标签、项目、摘要检索"
                ref={searchInputRef}
                value={query}
              />
              {query ? (
                <button aria-label="清除搜索" className="search-clear" onClick={() => setQuery("")} type="button">
                  <X size={16} />
                </button>
              ) : <kbd>⌘ K</kbd>}
            </div>
          </div>

          <div className="toolbar">
            <ThemeButton isDark={isDark} setIsDark={setIsDark} />
            <button
              aria-label={isFiltersOpen ? "收起筛选栏" : "展开筛选栏"}
              className="icon-button"
              onClick={() => setIsFiltersOpen((value) => !value)}
              title={isFiltersOpen ? "收起筛选栏" : "展开筛选栏"}
              type="button"
            >
              {isFiltersOpen ? <SidebarSimple size={19} /> : <SlidersHorizontal size={19} />}
            </button>
            {!site.readOnly && <button className="icon-text-button" onClick={() => navigate(user ? "/admin/posts/new" : "/login")} type="button">
              <Plus size={18} weight="bold" />写文章
            </button>}
            {site.subscription?.enabled && (
              <button className={subscription ? "subscribe is-on" : "subscribe"} onClick={() => setIsSubscriptionOpen(true)} type="button">
                <BellSimple size={18} weight={subscription ? "fill" : "regular"} />
                {subscription ? "已订阅" : site.subscription.title}
              </button>
            )}
          </div>
        </header>

        <div className="content-shell">
          <section className="main-panel">
            <div className="intro-grid">
              <div>
                <span className="eyebrow">{site.hero?.eyebrow}</span>
                <h1>{activeNav === "归档" ? "文章归档" : site.hero?.title}</h1>
                <p className="intro-copy">
                  {activeNav === "归档" ? "按更新时间浏览所有已发布内容，翻页回看持续积累的记录。" : site.hero?.description}
                </p>
              </div>
              <div className="stat-row" aria-label="内容统计">
                {site.stats.map((stat) => (
                  <div className="stat" key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>
                ))}
              </div>
            </div>

            <div className="content-controls">
              <div className="filter-row" aria-label="内容筛选">
                {site.filters.map((filter) => (
                  <button aria-pressed={activeFilter === filter} className={activeFilter === filter ? "chip is-active" : "chip"} key={filter} onClick={() => setActiveFilter(filter)} type="button">
                    {filter}
                  </button>
                ))}
              </div>
              <label className="sort-control"><span>排序</span>
                <select onChange={(event) => setSortMode(event.target.value)} value={sortMode}>
                  <option value="latest">最近更新</option><option value="oldest">最早更新</option><option value="shortest">阅读时间</option><option value="title">标题顺序</option>
                </select>
              </label>
            </div>

            <StatusBanner message={siteStatus === "error" || postsStatus === "error" ? errorMessage : ""} title="数据加载失败" />

            <div className="board">
              <section className="stack-card featured-list">
                <div className="section-heading">
                  <span>{query ? "搜索结果" : activeNav === "总览" ? "最近文章" : activeNav}</span>
                  <small>{postsStatus === "loading" ? "同步中" : `${pagination.total} 篇内容`}</small>
                </div>
                {postsStatus === "loading" ? (
                  <div className="empty-state"><strong>正在加载内容</strong><p>从后端同步文章列表。</p></div>
                ) : posts.length ? posts.map((post) => (
                  <button className="post-row" key={post.id} onClick={() => navigate(`/posts/${encodeURIComponent(post.slug)}`)} type="button">
                    <div className="post-row-meta"><span className="post-kind">{post.kind}</span><span>{post.date}</span><span>{post.readTime}</span></div>
                    <strong>{post.title}</strong><p>{post.excerpt}</p><ArrowRight size={18} />
                  </button>
                )) : (
                  <div className="empty-state"><strong>没有匹配内容</strong><p>换个关键词，或回到“全部”继续浏览。</p>
                    <button className="ghost-action" onClick={() => { setQuery(""); setActiveFilter("全部"); setActiveNav("总览"); }} type="button">重置筛选</button>
                  </div>
                )}
                {pagination.totalPages > 1 && (
                  <div className="pagination-bar" aria-label="文章分页">
                    <button className="icon-text-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button"><ArrowLeft size={17} />上一页</button>
                    <span>第 {page} / {pagination.totalPages} 页</span>
                    <button className="icon-text-button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} type="button">下一页<ArrowRight size={17} /></button>
                  </div>
                )}
              </section>

              <section className="stack-card note-card">
                <div className="section-heading"><span>技术笔记</span><small>{notesStatus === "loading" ? "同步中" : "速读"}</small></div>
                {notesStatus === "loading" ? <div className="empty-state"><strong>正在加载笔记</strong><p>获取技术笔记索引。</p></div> : notes.map((post) => (
                  <button className="note-item" key={post.id} onClick={() => navigate(`/posts/${encodeURIComponent(post.slug)}`)} type="button">
                    <BookOpen size={19} /><span><strong>{post.title}</strong><small>{post.excerpt}</small></span>
                  </button>
                ))}
              </section>
            </div>
          </section>

          <aside className={isFiltersOpen ? "right-rail" : "right-rail is-collapsed"} aria-label="筛选和更新">
            <button aria-label="关闭侧栏" className="rail-close" onClick={() => setIsFiltersOpen(false)} type="button"><X size={18} /></button>
            <section><h2>FILTER TAGS</h2><div className="tag-cloud">
              {site.filterTags.filter((tagName) => tagName !== "全部").map((tagName) => (
                <button className="tag" key={tagName} onClick={() => navigate(`/tags/${encodeURIComponent(tagName)}`)} type="button">{tagName}</button>
              ))}
            </div></section>
            <section><h2>LATEST</h2><div className="timeline">
              {timeline.map((item) => (
                <button className="timeline-item timeline-button" key={item.slug} onClick={() => navigate(`/posts/${encodeURIComponent(item.slug)}`)} type="button">
                  <time>{formatDateTime(item.date, { dateOnly: true })}</time><div><strong>{item.title}</strong><p>{item.text}</p></div>
                </button>
              ))}
            </div></section>
            {projects.length > 0 && <section><h2>PROJECTS</h2><div className="project-list">
              {projects.map((project) => (
                <button key={project.slug} onClick={() => navigate(`/posts/${encodeURIComponent(project.slug)}`)} type="button">
                  <FolderOpen size={19} /><span><strong>{project.name}</strong><small>{project.description}</small></span>
                </button>
              ))}
            </div></section>}
          </aside>
        </div>
      </section>

      <Modal description={site.subscription?.description} onClose={() => setIsSubscriptionOpen(false)} open={isSubscriptionOpen} title={subscription ? "管理订阅" : site.subscription?.title || "订阅更新"}>
        <StatusBanner message={subscriptionStatus === "error" ? errorMessage : ""} title="订阅操作失败" />
        {subscription ? (
          <div className="subscription-summary">
            <dl><div><dt>邮箱</dt><dd>{subscription.email}</dd></div><div><dt>主题</dt><dd>{subscription.topic}</dd></div></dl>
            <div className="form-actions"><button className="danger-action" disabled={subscriptionStatus === "loading"} onClick={cancelSubscription} type="button">取消订阅</button></div>
          </div>
        ) : (
          <form className="subscription-form" onSubmit={submitSubscription}>
            <label className="field"><span>邮箱</span><input autoComplete="email" onChange={(event) => setSubscriptionEmail(event.target.value)} placeholder="you@example.com" required type="email" value={subscriptionEmail} /></label>
            <p className="field-help">本次订阅主题：{activeFilter}</p>
            <div className="form-actions"><button className="primary-action" disabled={subscriptionStatus === "loading"} type="submit"><BellSimple size={18} />{subscriptionStatus === "loading" ? "提交中" : "加入更新名单"}</button></div>
          </form>
        )}
      </Modal>
      <Toast message={toastMessage} />
    </main>
  );
}
