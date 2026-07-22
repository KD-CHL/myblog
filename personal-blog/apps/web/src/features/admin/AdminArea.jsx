import { House } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useBodyScrollLock, useDocumentTitle } from "../../app/hooks.js";
import { MenuButton, SidebarScrim, ThemeButton } from "../../shared/components/Navigation.jsx";
import { AdminAudit } from "./AdminAudit.jsx";
import { AdminDashboard } from "./AdminDashboard.jsx";
import { AdminSettings } from "./AdminSettings.jsx";
import { AdminSidebar } from "./AdminSidebar.jsx";
import { AdminSubscriptions } from "./AdminSubscriptions.jsx";
import { PostEditor } from "./PostEditor.jsx";

const titles = {
  admin: "文章管理",
  "admin-audit": "操作记录",
  "admin-edit": "写作编辑器",
  "admin-new": "写作编辑器",
  "admin-settings": "站点设置",
  "admin-subscriptions": "订阅名单",
};

export function AdminArea({ authStatus, isDark, navigate, onLogout, route, setIsDark, user }) {
  const title = titles[route.name] || "管理后台";
  useDocumentTitle(`${title} | Knowledge Log`);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useBodyScrollLock(isMenuOpen);

  useEffect(() => {
    if (authStatus === "ready" && !user) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`, { replace: true });
    }
  }, [authStatus, navigate, user]);

  if (authStatus === "loading") {
    return <main className={isDark ? "app admin-app app-dark" : "app admin-app"}><section className="admin-loading"><strong>正在确认登录状态</strong></section></main>;
  }
  if (!user) return null;

  return (
    <main className={isDark ? "app admin-app app-dark" : "app admin-app"}>
      <a className="skip-link" href="#main-content">跳到后台内容</a>
      <AdminSidebar isOpen={isMenuOpen} navigate={navigate} onClose={() => setIsMenuOpen(false)} onLogout={onLogout} route={route} user={user} />
      <SidebarScrim isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <section className="workspace admin-workspace" id="main-content" tabIndex={-1}>
        <header className="topbar admin-topbar">
          <div className="topbar-leading"><MenuButton onClick={() => setIsMenuOpen(true)} /><div className="admin-title"><span className="post-kind">ADMIN</span><strong>{title}</strong></div></div>
          <div className="toolbar"><ThemeButton isDark={isDark} setIsDark={setIsDark} /><button className="icon-text-button" onClick={() => navigate("/")} type="button"><House size={18} />看博客</button></div>
        </header>

        {route.name === "admin" && <AdminDashboard navigate={navigate} />}
        {(route.name === "admin-new" || route.name === "admin-edit") && <PostEditor id={route.name === "admin-edit" ? route.id : ""} navigate={navigate} />}
        {route.name === "admin-settings" && <AdminSettings />}
        {route.name === "admin-audit" && <AdminAudit />}
        {route.name === "admin-subscriptions" && <AdminSubscriptions />}
      </section>
    </main>
  );
}
