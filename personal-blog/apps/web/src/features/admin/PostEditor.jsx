import {
  ArrowLeft,
  ClockCounterClockwise,
  Eye,
  FloppyDisk,
  NotePencil,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createPost,
  fetchPost,
  fetchPostRevisions,
  restorePostRevision,
  updatePost,
} from "../../api.js";
import { EDITOR_DRAFT_PREFIX, estimateReadTime, formatDateTime, readStoredJson, splitTags } from "../../shared/content.js";
import { emptyPostForm } from "../../shared/site.js";
import { Modal, StatusBanner } from "../../shared/components/Feedback.jsx";
import { PostContent } from "../../shared/components/PostContent.jsx";

export function PostEditor({ id, navigate }) {
  const isEditing = Boolean(id);
  const draftStorageKey = `${EDITOR_DRAFT_PREFIX}:${id || "new"}`;
  const [form, setForm] = useState(emptyPostForm);
  const [archivedAt, setArchivedAt] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [draftStatus, setDraftStatus] = useState("idle");
  const [recoveryDraft, setRecoveryDraft] = useState(null);
  const [viewMode, setViewMode] = useState(() => (window.innerWidth >= 1180 ? "split" : "edit"));
  const [revisions, setRevisions] = useState([]);
  const [revisionToRestore, setRevisionToRestore] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const formRef = useRef(null);
  const suggestedReadTime = useMemo(() => estimateReadTime(form.body), [form.body]);
  const bodyCharacterCount = useMemo(() => String(form.body || "").replace(/\s/g, "").length, [form.body]);

  useEffect(() => {
    let ignore = false;
    async function loadPost() {
      setStatus("loading");
      setErrorMessage("");
      setFieldErrors({});
      setIsDirty(false);
      try {
        let nextForm = { ...emptyPostForm };
        let nextRevisions = [];
        if (id) {
          const [postPayload, revisionsPayload] = await Promise.all([
            fetchPost(id, { includeArchived: true, includeDrafts: true }),
            fetchPostRevisions(id, { pageSize: 8 }),
          ]);
          const post = postPayload.post;
          nextForm = {
            body: post.body,
            category: post.category,
            excerpt: post.excerpt,
            featured: post.featured,
            kind: post.kind,
            readTime: post.readTime,
            slug: post.slug,
            status: post.publicationStatus,
            tags: post.tags.join(", "),
            title: post.title,
            version: post.version,
          };
          setArchivedAt(post.archivedAt);
          nextRevisions = revisionsPayload.revisions;
        }

        if (!ignore) {
          const localDraft = readStoredJson(draftStorageKey);
          setForm(nextForm);
          setRevisions(nextRevisions);
          setRecoveryDraft(localDraft?.form && JSON.stringify(localDraft.form) !== JSON.stringify(nextForm) ? localDraft : null);
          setStatus("ready");
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error.message);
          setStatus("error");
        }
      }
    }
    loadPost();
    return () => {
      ignore = true;
    };
  }, [draftStorageKey, id, reloadKey]);

  useEffect(() => {
    if (!isDirty || status === "loading" || status === "saving") return undefined;
    setDraftStatus("saving");
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftStorageKey, JSON.stringify({ form, savedAt: new Date().toISOString() }));
      setDraftStatus("saved");
    }, 650);
    return () => window.clearTimeout(timer);
  }, [draftStorageKey, form, isDirty, status]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setIsDirty(true);
    setDraftStatus("saving");
  }

  function validateForm() {
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = "请填写文章标题。";
    if (!form.excerpt.trim()) nextErrors.excerpt = "请填写文章摘要。";
    if (!form.body.trim()) nextErrors.body = "请填写文章正文。";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      window.requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return false;
    }
    return true;
  }

  async function save(nextStatus = form.status) {
    if (!validateForm()) return;
    setStatus("saving");
    setErrorMessage("");
    setFieldErrors({});
    const payload = { ...form, status: nextStatus, tags: splitTags(form.tags) };
    try {
      if (isEditing) await updatePost(id, payload);
      else await createPost(payload);
      window.localStorage.removeItem(draftStorageKey);
      window.sessionStorage.setItem("knowledge-log-admin-notice", nextStatus === "published" ? "文章已发布并可在公开博客查看。" : "草稿已安全保存。");
      setIsDirty(false);
      navigate("/admin");
    } catch (error) {
      setErrorMessage(error.code === "POST_VERSION_CONFLICT" ? "服务器中已有更新版本。请刷新页面核对内容后再保存。" : error.message);
      setFieldErrors(error.details?.fields || {});
      setStatus("error");
    }
  }

  async function confirmRevisionRestore() {
    if (!revisionToRestore) return;
    setStatus("saving");
    try {
      await restorePostRevision(id, revisionToRestore.version);
      window.localStorage.removeItem(draftStorageKey);
      setRevisionToRestore(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("error");
    }
  }

  function restoreLocalDraft() {
    if (!recoveryDraft?.form) return;
    setForm(recoveryDraft.form);
    setRecoveryDraft(null);
    setIsDirty(true);
    setDraftStatus("saved");
  }

  return (
    <section className="editor-panel">
      <div className="admin-hero editor-hero"><div><h1>{isEditing ? "编辑文章" : "新建文章"}</h1><p>{archivedAt ? "这篇文章当前在归档中，保存内容不会自动恢复。" : form.status === "published" ? "当前文章会展示在公开博客。" : "当前文章仅后台可见。"}</p><span className="editor-save-state" aria-live="polite">{draftStatus === "saving" ? "正在自动保存本地草稿" : draftStatus === "saved" ? "本地草稿已自动保存" : "修改会自动保存在本机"}</span></div><button className="ghost-action" onClick={() => navigate("/admin")} type="button"><ArrowLeft size={18} />返回列表</button></div>

      <StatusBanner message={errorMessage} title="保存失败" />
      <StatusBanner message={archivedAt ? "如需重新公开，请先回到文章管理页恢复文章。" : ""} title="文章已归档" tone="info" />
      <StatusBanner message={recoveryDraft ? `发现 ${formatDateTime(recoveryDraft.savedAt)} 自动保存的未提交内容。` : ""} title="找到本地草稿" tone="info"><div className="banner-actions"><button className="ghost-action" onClick={() => { window.localStorage.removeItem(draftStorageKey); setRecoveryDraft(null); }} type="button">忽略</button><button className="primary-action" onClick={restoreLocalDraft} type="button">恢复草稿</button></div></StatusBanner>

      {status === "loading" ? <div className="empty-state"><strong>正在加载编辑内容</strong><p>读取文章正文和修订记录。</p></div> : <>
        {isEditing && revisions.length > 0 && <section className="revision-strip" aria-label="修订历史"><div className="revision-strip-title"><ClockCounterClockwise size={18} /><span>修订历史</span></div><div className="revision-list">{revisions.map((revision) => <button disabled={revision.version === form.version || status === "saving"} key={revision.id} onClick={() => setRevisionToRestore(revision)} type="button"><strong>v{revision.version}</strong><span>{formatDateTime(revision.createdAt)}</span><small>{revision.actor || "system"}</small></button>)}</div></section>}
        <div className="editor-toolbar"><div className="editor-stats" aria-label="正文统计"><span>{bodyCharacterCount} 字</span><span>预计 {suggestedReadTime}</span><span>版本 v{form.version}</span></div><div className="segmented-control" aria-label="编辑器视图">{[["edit", "编辑"], ["split", "分栏"], ["preview", "预览"]].map(([value, label]) => <button aria-pressed={viewMode === value} className={viewMode === value ? "is-active" : ""} key={value} onClick={() => setViewMode(value)} type="button">{label}</button>)}</div></div>

        <form className={`editor-form view-${viewMode}`} onSubmit={(event) => { event.preventDefault(); save(form.status); }} ref={formRef}>
          <div className="editor-fields">
            <label className="field wide-field"><span>标题 *</span><input aria-invalid={Boolean(fieldErrors.title)} onChange={(event) => updateField("title", event.target.value)} placeholder="写一个清晰的文章标题" value={form.title} />{fieldErrors.title && <small className="field-error" role="alert">{fieldErrors.title}</small>}</label>
            <label className="field"><span>Slug</span><input onChange={(event) => updateField("slug", event.target.value)} placeholder="留空则按标题生成" value={form.slug} /><small className="field-help">用于文章网址，留空会自动生成。</small></label>
            <label className="field"><span>分类</span><select onChange={(event) => updateField("category", event.target.value)} value={form.category}><option>文章库</option><option>技术笔记</option><option>作品集</option><option>生活随笔</option></select></label>
            <label className="field"><span>类型</span><select onChange={(event) => updateField("kind", event.target.value)} value={form.kind}><option>ARTICLE</option><option>NOTE</option><option>PROJECT</option><option>LIFE</option></select></label>
            <label className="field"><span>阅读时间</span><div className="input-with-action"><input onChange={(event) => updateField("readTime", event.target.value)} placeholder="5 min" value={form.readTime} /><button onClick={() => updateField("readTime", suggestedReadTime)} type="button">自动估算</button></div></label>
            <label className="field wide-field"><span>摘要 *</span><textarea aria-invalid={Boolean(fieldErrors.excerpt)} onChange={(event) => updateField("excerpt", event.target.value)} placeholder="一句话说明这篇文章解决什么问题" rows={3} value={form.excerpt} />{fieldErrors.excerpt && <small className="field-error" role="alert">{fieldErrors.excerpt}</small>}</label>
            <label className="field wide-field"><span>标签</span><input onChange={(event) => updateField("tags", event.target.value)} placeholder="写作, 前端, 产品" value={form.tags} /><small className="field-help">多个标签使用英文逗号分隔。</small></label>
            <label className="field wide-field body-field"><span>正文 *</span><textarea aria-invalid={Boolean(fieldErrors.body)} onChange={(event) => updateField("body", event.target.value)} placeholder={"支持段落、# 标题、- 列表、> 引用和 ``` 代码块"} rows={18} value={form.body} />{fieldErrors.body ? <small className="field-error" role="alert">{fieldErrors.body}</small> : <small className="field-help">段落之间留空行，预览会实时更新。</small>}</label>
            <div className="editor-options"><label><input checked={form.featured} onChange={(event) => updateField("featured", event.target.checked)} type="checkbox" /><span>精选</span></label><div className="segmented-control" aria-label="发布状态">{[["draft", "草稿"], ["published", "已发布"]].map(([value, label]) => <button aria-pressed={form.status === value} className={form.status === value ? "is-active" : ""} key={value} onClick={() => updateField("status", value)} type="button">{label}</button>)}</div></div>
            <div className="form-actions editor-actions"><button className="ghost-action" disabled={status === "saving"} onClick={() => save("draft")} type="button"><FloppyDisk size={18} />保存草稿</button><button className="primary-action" disabled={status === "saving" || Boolean(archivedAt)} onClick={() => save("published")} type="button"><NotePencil size={18} />{status === "saving" ? "保存中" : "发布文章"}</button></div>
          </div>
          <aside className="editor-preview" aria-label="文章实时预览"><div className="preview-label"><Eye size={17} />实时预览</div><article className="preview-article"><span className="post-kind">{form.kind}</span><h2>{form.title || "文章标题"}</h2><p className="article-excerpt">{form.excerpt || "文章摘要会显示在这里。"}</p><div className="meta-row"><span>{form.readTime || suggestedReadTime}</span><span>{form.category}</span></div><div className="tag-row compact-tags">{splitTags(form.tags).map((tag) => <span key={tag}>{tag}</span>)}</div><PostContent body={form.body} compact /></article></aside>
        </form>
      </>}

      <Modal description={`将文章恢复到 v${revisionToRestore?.version || ""} 的内容，并生成一个新的修订版本。`} onClose={() => setRevisionToRestore(null)} open={Boolean(revisionToRestore)} title="恢复历史版本"><div className="form-actions modal-actions"><button className="ghost-action" onClick={() => setRevisionToRestore(null)} type="button">取消</button><button className="primary-action" disabled={status === "saving"} onClick={confirmRevisionRestore} type="button">确认恢复</button></div></Modal>
    </section>
  );
}
