import { ArrowLeft, CalendarBlank, Clock, Copy, FolderOpen, PencilSimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { fetchPost, fetchPosts, fetchSite } from "../api.js";
import { useBodyScrollLock, useDocumentTitle } from "../app/hooks.js";
import { fallbackSite } from "../shared/site.js";
import { StatusBanner, Toast } from "../shared/components/Feedback.jsx";
import { MenuButton, PublicSidebar, SidebarScrim, ThemeButton } from "../shared/components/Navigation.jsx";
import { PostContent } from "../shared/components/PostContent.jsx";

export function PostPage({ isDark, navigate, setIsDark, user, slug }) {
  const [siteBundle, setSiteBundle] = useState(null);
  const [post, setPost] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const site = siteBundle?.site ?? fallbackSite;

  useBodyScrollLock(isMenuOpen);
  useDocumentTitle(post ? `${post.title} | ${site.brand.title}` : `文章 | ${site.brand.title}`);

  useEffect(() => {
    let ignore = false;
    setStatus("loading");
    Promise.all([fetchSite(), fetchPost(slug), fetchPosts({ pageSize: 30 })])
      .then(([sitePayload, postPayload, postsPayload]) => {
        if (ignore) return;
        const currentPost = postPayload.post;
        setSiteBundle(sitePayload);
        setPost(currentPost);
        setRelatedPosts(
          postsPayload.posts
            .filter((candidate) => candidate.id !== currentPost.id)
            .map((candidate) => ({
              ...candidate,
              relevance:
                (candidate.category === currentPost.category ? 2 : 0) +
                candidate.tags.filter((tag) => currentPost.tags.includes(tag)).length,
            }))
            .filter((candidate) => candidate.relevance > 0)
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 3),
        );
        setStatus("ready");
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
  }, [slug]);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = window.setTimeout(() => setToastMessage(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  async function copyArticleLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToastMessage("文章链接已复制");
    } catch {
      setErrorMessage("无法复制链接，请从浏览器地址栏复制。");
    }
  }

  return (
    <main className={isDark ? "app article-app app-dark" : "app article-app"}>
      <a className="skip-link" href="#main-content">跳到文章正文</a>
      <PublicSidebar activeNav={post?.category || "文章库"} isOpen={isMenuOpen} navigate={navigate} onClose={() => setIsMenuOpen(false)} setActiveNav={() => undefined} site={site} user={user} />
      <SidebarScrim isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <section className="workspace article-workspace" id="main-content" tabIndex={-1}>
        <header className="topbar article-topbar">
          <div className="topbar-leading"><MenuButton onClick={() => setIsMenuOpen(true)} />
            <button className="icon-text-button" onClick={() => navigate("/")} type="button"><ArrowLeft size={18} />返回首页</button>
          </div>
          <div className="toolbar"><ThemeButton isDark={isDark} setIsDark={setIsDark} />
            <button className="icon-text-button" onClick={copyArticleLink} type="button"><Copy size={18} />复制链接</button>
            {user && post && <button className="icon-text-button" onClick={() => navigate(`/admin/posts/${encodeURIComponent(post.id)}/edit`)} type="button"><PencilSimple size={18} />编辑</button>}
          </div>
        </header>

        <article className="article-page">
          {status === "loading" && <div className="empty-state"><strong>正在加载文章</strong><p>同步正文和元数据。</p></div>}
          {status === "error" && <StatusBanner message={errorMessage} title="文章加载失败" />}
          {post && <>
            <header className="article-header">
              <span className="post-kind">{post.kind}</span><h1>{post.title}</h1><p className="article-excerpt">{post.excerpt}</p>
              <div className="meta-row article-meta"><span><CalendarBlank size={16} />{post.date}</span><span><Clock size={16} />{post.readTime}</span><span><FolderOpen size={16} />{post.category}</span></div>
              <div className="tag-row">{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            </header>
            <div className="article-body"><PostContent body={post.body} /></div>
            {relatedPosts.length > 0 && <section className="related-posts" aria-labelledby="related-posts-title">
              <div className="section-heading"><span id="related-posts-title">继续阅读</span><small>相同分类与标签</small></div>
              <div className="related-grid">{relatedPosts.map((relatedPost) => (
                <button key={relatedPost.id} onClick={() => navigate(`/posts/${encodeURIComponent(relatedPost.slug)}`)} type="button"><span className="post-kind">{relatedPost.kind}</span><strong>{relatedPost.title}</strong><small>{relatedPost.readTime}</small></button>
              ))}</div>
            </section>}
          </>}
        </article>
      </section>
      <Toast message={toastMessage} />
    </main>
  );
}
