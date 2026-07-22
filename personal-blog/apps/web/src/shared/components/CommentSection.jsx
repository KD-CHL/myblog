import { ChatCircleText, PaperPlaneTilt } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { createComment, fetchPostComments } from "../../api.js";
import { formatDateTime } from "../content.js";
import { StatusBanner, Toast } from "./Feedback.jsx";

const AVATAR_HUES = ["blue", "pink", "lime"];

function avatarHue(name) {
  let hash = 0;
  for (const char of String(name || "")) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return AVATAR_HUES[hash % AVATAR_HUES.length];
}

function CommentAvatar({ name }) {
  return (
    <span className="comment-avatar" data-hue={avatarHue(name)}>
      {String(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function CommentSection({ postId, readOnly = false }) {
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [content, setContent] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const loadComments = useCallback(() => {
    let ignore = false;
    setStatus("loading");
    fetchPostComments(postId, { pageSize: 50 })
      .then((payload) => {
        if (ignore) return;
        setComments(payload.comments || []);
        setTotal(payload.pagination?.total || 0);
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
  }, [postId]);

  useEffect(() => loadComments(), [loadComments]);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = window.setTimeout(() => setToastMessage(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFieldErrors({});
    setErrorMessage("");
    setSubmitting(true);
    try {
      const payload = await createComment(postId, { authorEmail, authorName, content });
      setComments((previous) => [payload.comment, ...previous]);
      setTotal((previous) => previous + 1);
      setContent("");
      setToastMessage("评论已发布");
    } catch (error) {
      if (error.details?.fields) {
        setFieldErrors(error.details.fields);
      } else {
        setErrorMessage(error.message || "评论提交失败，请稍后重试。");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="comments-title" className="comment-section">
      <div className="section-heading">
        <span id="comments-title">
          <ChatCircleText size={20} style={{ verticalAlign: "-4px", marginRight: 8 }} />
          评论{total > 0 ? ` (${total})` : ""}
        </span>
      </div>

      {status === "loading" && <p className="comment-empty">正在加载评论…</p>}
      {status === "error" && <StatusBanner message={errorMessage} title="评论加载失败" />}
      {status === "ready" && comments.length === 0 && (
        <p className="comment-empty">还没有评论，来留下第一条吧。</p>
      )}

      {comments.length > 0 && (
        <div className="comment-list">
          {comments.map((comment) => (
            <article className="comment-item" key={comment.id}>
              <CommentAvatar name={comment.authorName} />
              <div className="comment-body">
                <header className="comment-meta">
                  <strong>{comment.authorName}</strong>
                  <time>{formatDateTime(comment.createdAt)}</time>
                </header>
                <p className="comment-content">{comment.content}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      {readOnly ? (
        <p className="comment-empty">当前为只读模式，暂不支持评论。</p>
      ) : (
        <form className="comment-form" onSubmit={handleSubmit}>
          <div className="comment-form-row">
            <label className="field">
              <span>昵称 *</span>
              <input
                maxLength={40}
                onChange={(event) => setAuthorName(event.target.value)}
                placeholder="怎么称呼你"
                required
                value={authorName}
              />
              {fieldErrors.authorName && <small className="field-error">{fieldErrors.authorName}</small>}
            </label>
            <label className="field">
              <span>邮箱（选填，不会公开）</span>
              <input
                maxLength={254}
                onChange={(event) => setAuthorEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={authorEmail}
              />
              {fieldErrors.authorEmail && <small className="field-error">{fieldErrors.authorEmail}</small>}
            </label>
          </div>
          <label className="field">
            <span>评论内容 *</span>
            <textarea
              maxLength={1000}
              onChange={(event) => setContent(event.target.value)}
              placeholder="分享你的想法…"
              required
              rows={4}
              value={content}
            />
            <span className="comment-counter">{content.length}/1000</span>
            {fieldErrors.content && <small className="field-error">{fieldErrors.content}</small>}
          </label>
          {errorMessage && <StatusBanner message={errorMessage} />}
          <div className="comment-form-actions">
            <button className="primary-action" disabled={submitting} type="submit">
              <PaperPlaneTilt size={18} />
              {submitting ? "提交中…" : "发布评论"}
            </button>
          </div>
        </form>
      )}

      <Toast message={toastMessage} />
    </section>
  );
}
