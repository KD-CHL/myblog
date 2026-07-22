import { ArrowLeft, ArrowRight, EnvelopeSimple, Users } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { fetchSubscriptions } from "../../api.js";
import { formatDateTime } from "../../shared/content.js";
import { StatusBanner } from "../../shared/components/Feedback.jsx";

export function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("active");
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let ignore = false;
    setStatus("loading");
    fetchSubscriptions({ page, pageSize: 30, status: filter })
      .then((payload) => {
        if (!ignore) {
          setSubscriptions(payload.subscriptions);
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

  return (
    <section className="admin-panel subscriptions-panel">
      <div className="admin-hero"><div><h1>订阅名单</h1><p>查看读者主动留下的邮箱和关注主题，不包含退订凭证。</p></div><span className="section-icon"><Users size={22} /></span></div>
      <div className="admin-controls compact-admin-controls"><div className="segmented-control" aria-label="订阅状态">{[["active", "有效"], ["inactive", "已退订"], ["all", "全部"]].map(([value, label]) => <button aria-pressed={filter === value} className={filter === value ? "is-active" : ""} key={value} onClick={() => { setFilter(value); setPage(1); }} type="button">{label}</button>)}</div><span className="result-count">{pagination.total} 个邮箱</span></div>
      <StatusBanner message={status === "error" ? errorMessage : ""} title="订阅名单加载失败" />
      <section className="subscriber-list" aria-label="订阅邮箱">
        {status === "loading" ? <div className="empty-state"><strong>正在读取订阅名单</strong><p>同步有效邮箱与主题。</p></div> : subscriptions.length ? subscriptions.map((subscription) => (
          <article className="subscriber-row" key={subscription.id}><span className="subscriber-icon"><EnvelopeSimple size={19} /></span><div><strong>{subscription.email}</strong><p>主题：{subscription.topic}</p></div><span className={`status-pill is-${subscription.status}`}>{subscription.status === "active" ? "有效" : "已退订"}</span><time>{formatDateTime(subscription.createdAt)}</time></article>
        )) : <div className="empty-state"><strong>暂无订阅</strong><p>公开首页收到订阅后会出现在这里。</p></div>}
      </section>
      {pagination.totalPages > 1 && <div className="pagination-bar"><button className="icon-text-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button"><ArrowLeft size={17} />上一页</button><span>第 {page} / {pagination.totalPages} 页</span><button className="icon-text-button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} type="button">下一页<ArrowRight size={17} /></button></div>}
    </section>
  );
}
