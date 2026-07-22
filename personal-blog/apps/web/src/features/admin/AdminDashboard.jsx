import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  DownloadSimple,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import {
  archivePost,
  fetchContentExport,
  fetchAdminDashboard,
  fetchPosts,
  purgePost,
  restorePost,
  updatePost,
} from "../../api.js";
import { useDebouncedValue } from "../../app/hooks.js";
import { consumeSessionMessage, formatDateTime } from "../../shared/content.js";
import { Modal, StatusBanner } from "../../shared/components/Feedback.jsx";

const initialStats = { archived: 0, draft: 0, published: 0, subscribers: 0, total: 0 };

export function AdminDashboard({ navigate }) {
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState(initialStats);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState("latest");
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [noticeMessage] = useState(() => consumeSessionMessage("knowledge-log-admin-notice"));
  const debouncedQuery = useDebouncedValue(query, 180);

  async function loadDashboard() {
    const payload = await fetchAdminDashboard();
    setStats(payload.stats);
  }

  async function loadPosts() {
    setStatus("loading");
    try {
      const payload = await fetchPosts({
        includeDrafts: true,
        page,
        pageSize: 12,
        query: debouncedQuery,
        sort: sortMode,
        status: statusFilter,
      });
      setPosts(payload.posts);
      setPagination(payload.pagination);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("error");
    }
  }

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, sortMode, statusFilter]);

  useEffect(() => {
    loadPosts();
  }, [page, debouncedQuery, sortMode, statusFilter]);

  useEffect(() => {
    loadDashboard().catch((error) => {
      setErrorMessage(error.message);
      setStatus("error");
    });
  }, []);

  async function refresh() {
    await Promise.all([loadPosts(), loadDashboard()]);
  }

  async function changeStatus(post, nextStatus) {
    setBusyId(post.id);
    setErrorMessage("");
    try {
      await updatePost(post.id, { status: nextStatus, version: post.version });
      await refresh();
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("error");
    } finally {
      setBusyId("");
    }
  }

  async function confirmPendingAction() {
    const { post, type } = pendingAction || {};
    if (!post) return;
    setBusyId(post.id);
    setErrorMessage("");
    try {
      if (type === "archive") await archivePost(post.id, post.version);
      else if (type === "purge") await purgePost(post.id, confirmTitle);
      setPendingAction(null);
      setConfirmTitle("");
      await refresh();
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("error");
    } finally {
      setBusyId("");
    }
  }

  async function handleRestore(post) {
    setBusyId(post.id);
    try {
      await restorePost(post.id, post.version);
      await refresh();
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("error");
    } finally {
      setBusyId("");
    }
  }

  async function downloadBackup() {
    try {
      const payload = await fetchContentExport();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `knowledge-log-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("error");
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-hero"><div><h1>文章管理</h1><p>从草稿到发布，再到可恢复归档，所有内容状态都在这里。</p></div><div className="admin-hero-actions"><button className="ghost-action" onClick={downloadBackup} type="button"><DownloadSimple size={18} />导出备份</button><button className="primary-action" onClick={() => navigate("/admin/posts/new")} type="button"><Plus size={18} weight="bold" />新建文章</button></div></div>

      <div className="admin-metrics">
        {[
          [stats.total, "全部文章"], [stats.published, "已发布"], [stats.draft, "草稿"], [stats.archived, "已归档"], [stats.subscribers, "有效订阅"],
        ].map(([value, label]) => <div className="stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </div>

      <div className="admin-controls">
        <div className="search-box admin-search" role="search"><MagnifyingGlass size={19} weight="bold" /><input aria-label="搜索后台文章" onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、摘要、标签" value={query} />{query && <button aria-label="清除搜索" className="search-clear" onClick={() => setQuery("")} type="button"><X size={16} /></button>}</div>
        <div className="segmented-control" aria-label="文章状态">
          {[["all", "全部"], ["draft", "草稿"], ["published", "已发布"], ["archived", "归档"]].map(([value, label]) => (
            <button aria-pressed={statusFilter === value} className={statusFilter === value ? "is-active" : ""} key={value} onClick={() => setStatusFilter(value)} type="button">{label}</button>
          ))}
        </div>
        <label className="sort-control admin-sort"><span>排序</span><select onChange={(event) => setSortMode(event.target.value)} value={sortMode}><option value="latest">最近更新</option><option value="oldest">最早更新</option><option value="title">标题顺序</option></select></label>
      </div>

      <StatusBanner message={noticeMessage} title="操作成功" tone="success" />
      <StatusBanner message={status === "error" ? errorMessage : ""} title="后台操作失败" />

      <section className="admin-list" aria-label="文章列表">
        <div className="admin-list-head"><span>文章</span><span>状态</span><span>操作</span></div>
        {status === "loading" ? <div className="empty-state"><strong>正在同步后台文章</strong><p>读取文章状态和最新版本。</p></div> : posts.length ? posts.map((post) => (
          <article className="admin-row" key={post.id}>
            <div><span className="post-kind">{post.kind}</span><strong>{post.title}</strong><p>{post.excerpt}</p><div className="admin-row-meta"><span>{post.category}</span><span>{post.readTime}</span><span>更新于 {formatDateTime(post.updatedAt)}</span><span>v{post.version}</span></div><div className="tag-row compact-tags">{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
            <span className={`status-pill is-${post.status}`}>{post.status === "published" ? "已发布" : post.status === "archived" ? "已归档" : "草稿"}</span>
            <div className="row-actions">
              <button aria-label={`编辑 ${post.title}`} className="icon-button" onClick={() => navigate(`/admin/posts/${encodeURIComponent(post.id)}/edit`)} type="button"><PencilSimple size={18} /></button>
              {post.status === "archived" ? <>
                <button className="icon-text-button" disabled={busyId === post.id} onClick={() => handleRestore(post)} type="button"><CheckCircle size={18} />恢复</button>
                <button aria-label={`永久删除 ${post.title}`} className="icon-button danger-button" disabled={busyId === post.id} onClick={() => setPendingAction({ post, type: "purge" })} type="button"><Trash size={18} /></button>
              </> : <>
                <button className="icon-text-button" disabled={busyId === post.id} onClick={() => changeStatus(post, post.status === "published" ? "draft" : "published")} type="button"><CheckCircle size={18} />{post.status === "published" ? "下架" : "发布"}</button>
                <button aria-label={`归档 ${post.title}`} className="icon-button danger-button" disabled={busyId === post.id} onClick={() => setPendingAction({ post, type: "archive" })} type="button"><Archive size={18} /></button>
              </>}
            </div>
          </article>
        )) : <div className="empty-state"><strong>没有匹配文章</strong><p>调整搜索或状态筛选后再看。</p></div>}
        {pagination.totalPages > 1 && <div className="pagination-bar"><button className="icon-text-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button"><ArrowLeft size={17} />上一页</button><span>第 {page} / {pagination.totalPages} 页</span><button className="icon-text-button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} type="button">下一页<ArrowRight size={17} /></button></div>}
      </section>

      <Modal description={pendingAction?.type === "purge" ? "此操作不可恢复。请输入完整标题进行确认。" : "文章会从公开博客和默认列表中移除，之后仍可恢复。"} onClose={() => { setPendingAction(null); setConfirmTitle(""); }} open={Boolean(pendingAction)} title={pendingAction?.type === "purge" ? "永久删除文章" : "归档文章"}>
        {pendingAction?.type === "purge" && <label className="field"><span>确认标题</span><input onChange={(event) => setConfirmTitle(event.target.value)} placeholder={pendingAction.post.title} value={confirmTitle} /></label>}
        <div className="form-actions modal-actions"><button className="ghost-action" onClick={() => setPendingAction(null)} type="button">取消</button><button className={pendingAction?.type === "purge" ? "danger-action" : "primary-action"} disabled={busyId || (pendingAction?.type === "purge" && confirmTitle !== pendingAction.post.title)} onClick={confirmPendingAction} type="button">{pendingAction?.type === "purge" ? "永久删除" : "确认归档"}</button></div>
      </Modal>
    </section>
  );
}
