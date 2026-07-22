import { ArrowLeft, ArrowRight, ChatCircleText, Eye, EyeSlash, Trash } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { approveComment, deleteComment, fetchAdminComments, hideComment } from "../../api.js";
import { formatDateTime } from "../../shared/content.js";
import { Modal, StatusBanner } from "../../shared/components/Feedback.jsx";

const AVATAR_HUES = ["blue", "pink", "lime"];

function avatarHue(name) {
  let hash = 0;
  for (const char of String(name || "")) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return AVATAR_HUES[hash % AVATAR_HUES.length];
}

export function AdminComments({ navigate }) {
  const [comments, setComments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let ignore = false;
    setStatus("loading");
    fetchAdminComments({ page, pageSize: 20, status: filter })
      .then((payload) => {
        if (!ignore) {
          setComments(payload.comments);
          setPagination(payload.pagination);
          setStatus("ready");
        }
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
  }, [filter, page]);

  async function refresh() {
    try {
      const payload = await fetchAdminComments({ page, pageSize: 20, status: filter });
      setComments(payload.comments);
      setPagination(payload.pagination);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function toggleVisibility(comment) {
    setActing(true);
    setErrorMessage("");
    try {
      if (comment.status === "approved") await hideComment(comment.id);
      else await approveComment(comment.id);
      await refresh();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setActing(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setActing(true);
    setErrorMessage("");
    try {
      await deleteComment(pendingDelete.id);
      setPendingDelete(null);
      await refresh();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setActing(false);
    }
  }

  return (
    <section className="admin-panel comments-panel">
      <div className="admin-hero">
        <div>
          <h1>评论管理</h1>
          <p>审核读者在文章下留下的评论，可隐藏、恢复或删除。</p>
        </div>
        <span className="section-icon"><ChatCircleText size={22} /></span>
      </div>

      <div className="admin-controls compact-admin-controls">
        <div aria-label="评论状态" className="segmented-control">
          {[["all", "全部"], ["approved", "已显示"], ["hidden", "已隐藏"]].map(([value, label]) => (
            <button
              aria-pressed={filter === value}
              className={filter === value ? "is-active" : ""}
              key={value}
              onClick={() => { setFilter(value); setPage(1); }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <span className="result-count">{pagination.total} 条评论</span>
      </div>

      <StatusBanner message={status === "error" ? errorMessage : ""} title="评论加载失败" />

      <section aria-label="评论列表" className="comment-admin-list">
        {status === "loading" ? (
          <div className="empty-state"><strong>正在读取评论</strong><p>同步评论内容与状态。</p></div>
        ) : comments.length ? (
          comments.map((comment) => (
            <article className="comment-admin-row" key={comment.id}>
              <span className="comment-avatar" data-hue={avatarHue(comment.authorName)}>
                {String(comment.authorName || "?").trim().charAt(0).toUpperCase()}
              </span>
              <div className="comment-admin-main">
                <strong>{comment.authorName}{comment.authorEmail ? <small className="comment-email"> {comment.authorEmail}</small> : null}</strong>
                <p className="comment-admin-content">{comment.content}</p>
                <p className="comment-admin-meta">
                  {comment.postTitle ? (
                    <button className="ghost-action" onClick={() => navigate(`/posts/${encodeURIComponent(comment.postSlug)}`)} type="button">
                      {comment.postTitle}
                    </button>
                  ) : "文章已删除"}
                  <time>{formatDateTime(comment.createdAt)}</time>
                </p>
              </div>
              <span className={`status-pill is-${comment.status === "approved" ? "active" : "inactive"}`}>
                {comment.status === "approved" ? "已显示" : "已隐藏"}
              </span>
              <div className="row-actions">
                <button className="ghost-action" disabled={acting} onClick={() => toggleVisibility(comment)} type="button">
                  {comment.status === "approved" ? <EyeSlash size={16} /> : <Eye size={16} />}
                  {comment.status === "approved" ? "隐藏" : "恢复"}
                </button>
                <button className="ghost-action danger-button" disabled={acting} onClick={() => setPendingDelete(comment)} type="button">
                  <Trash size={16} />删除
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state"><strong>暂无评论</strong><p>读者在文章页发表评论后会出现在这里。</p></div>
        )}
      </section>

      {pagination.totalPages > 1 && (
        <div className="pagination-bar">
          <button className="icon-text-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button"><ArrowLeft size={17} />上一页</button>
          <span>第 {page} / {pagination.totalPages} 页</span>
          <button className="icon-text-button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} type="button">下一页<ArrowRight size={17} /></button>
        </div>
      )}

      <Modal
        description="删除后无法恢复，请确认操作。"
        onClose={() => setPendingDelete(null)}
        open={Boolean(pendingDelete)}
        title="删除这条评论？"
      >
        <p className="modal-confirm-text">
          将永久删除「{pendingDelete?.authorName}」的评论：{pendingDelete?.content.slice(0, 60)}
          {(pendingDelete?.content.length || 0) > 60 ? "…" : ""}
        </p>
        <div className="modal-actions">
          <button className="ghost-action" onClick={() => setPendingDelete(null)} type="button">取消</button>
          <button className="danger-action" disabled={acting} onClick={confirmDelete} type="button">
            {acting ? "删除中…" : "确认删除"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
