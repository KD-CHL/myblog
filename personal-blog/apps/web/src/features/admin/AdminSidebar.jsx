import {
  ClockCounterClockwise,
  FileText,
  Gear,
  Plus,
  SignOut,
  Users,
  X,
} from "@phosphor-icons/react";

const links = [
  { icon: FileText, label: "文章管理", names: ["admin"], path: "/admin" },
  { icon: Plus, label: "新建文章", names: ["admin-new", "admin-edit"], path: "/admin/posts/new" },
  { icon: Gear, label: "站点设置", names: ["admin-settings"], path: "/admin/settings" },
  { icon: Users, label: "订阅名单", names: ["admin-subscriptions"], path: "/admin/subscriptions" },
  { icon: ClockCounterClockwise, label: "操作记录", names: ["admin-audit"], path: "/admin/audit" },
];

export function AdminSidebar({ isOpen, navigate, onClose, onLogout, route, user }) {
  return (
    <aside className={isOpen ? "sidebar admin-sidebar is-open" : "sidebar admin-sidebar"} aria-label="后台导航">
      <button aria-label="关闭导航" className="sidebar-close" onClick={onClose} type="button"><X size={20} /></button>
      <button className="brand brand-button" onClick={() => navigate("/admin")} type="button">
        <span className="brand-mark">K</span><span><strong>Knowledge Log</strong><span>{user.username}</span></span>
      </button>
      <nav className="side-nav">
        {links.map(({ icon: Icon, label, names, path }) => {
          const active = names.includes(route.name);
          return (
            <button aria-current={active ? "page" : undefined} className={active ? "is-active" : ""} key={path} onClick={() => { onClose(); navigate(path); }} type="button">
              <Icon size={18} /><span>{label}</span>
            </button>
          );
        })}
      </nav>
      <div className="writing-state"><p>PUBLISH FLOW</p><span>保存草稿、检查预览、发布内容；归档文章可随时恢复。</span></div>
      <div className="sidebar-actions"><button onClick={() => { onClose(); onLogout(); }} type="button"><SignOut size={17} /><span>退出登录</span></button></div>
    </aside>
  );
}
