import { ArrowLeft, ArrowRight, ClockCounterClockwise } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { fetchAuditEvents } from "../../api.js";
import { actionLabel, formatDateTime } from "../../shared/content.js";
import { StatusBanner } from "../../shared/components/Feedback.jsx";

const actionOptions = [
  ["", "全部操作"],
  ["post.published", "发布文章"],
  ["post.updated", "更新文章"],
  ["post.archived", "归档文章"],
  ["auth.login", "登录后台"],
  ["site.settings_updated", "站点设置"],
  ["subscription.created", "新增订阅"],
];

export function AdminAudit() {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let ignore = false;
    setStatus("loading");
    fetchAuditEvents({ action, page, pageSize: 25 })
      .then((payload) => {
        if (!ignore) {
          setEvents(payload.events);
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
  }, [action, page]);

  return (
    <section className="admin-panel audit-panel">
      <div className="admin-hero"><div><h1>操作记录</h1><p>追踪登录、文章状态、站点设置和订阅变化。</p></div><span className="section-icon"><ClockCounterClockwise size={22} /></span></div>
      <div className="admin-controls compact-admin-controls"><label className="sort-control"><span>操作类型</span><select onChange={(event) => { setAction(event.target.value); setPage(1); }} value={action}>{actionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><span className="result-count">{pagination.total} 条记录</span></div>
      <StatusBanner message={status === "error" ? errorMessage : ""} title="操作记录加载失败" />
      <section className="activity-list" aria-label="操作记录">
        {status === "loading" ? <div className="empty-state"><strong>正在读取操作记录</strong><p>同步最近的后台行为。</p></div> : events.length ? events.map((event) => (
          <article className="activity-row" key={event.id}>
            <span className={`activity-marker action-${event.action.replaceAll(".", "-")}`} />
            <div><strong>{actionLabel(event.action)}</strong><p>{event.entityType === "post" ? `文章 ${event.entityId || "-"}` : event.entityType === "subscription" ? "订阅名单" : event.entityType}</p></div>
            <div className="activity-meta"><span>{event.actor || "公开访客"}</span><time>{formatDateTime(event.createdAt)}</time><code>{event.requestId?.slice(0, 8) || "-"}</code></div>
          </article>
        )) : <div className="empty-state"><strong>暂无记录</strong><p>当前筛选下没有操作事件。</p></div>}
      </section>
      {pagination.totalPages > 1 && <div className="pagination-bar"><button className="icon-text-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button"><ArrowLeft size={17} />上一页</button><span>第 {page} / {pagination.totalPages} 页</span><button className="icon-text-button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} type="button">下一页<ArrowRight size={17} /></button></div>}
    </section>
  );
}
