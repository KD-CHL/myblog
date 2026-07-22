import {
  Archive,
  Article,
  BookOpen,
  Briefcase,
  Coffee,
  FileText,
  House,
  LockKey,
  Moon,
  SidebarSimple,
  Sun,
  X,
} from "@phosphor-icons/react";

const navIcons = {
  总览: House,
  文章库: Article,
  技术笔记: BookOpen,
  作品集: Briefcase,
  生活随笔: Coffee,
  归档: Archive,
};

export function ThemeButton({ isDark, setIsDark }) {
  return (
    <button
      aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
      className="icon-button"
      onClick={() => setIsDark((value) => !value)}
      title={isDark ? "切换到浅色模式" : "切换到深色模式"}
      type="button"
    >
      {isDark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

export function MenuButton({ onClick }) {
  return (
    <button aria-label="打开导航" className="icon-button mobile-menu-button" onClick={onClick} type="button">
      <SidebarSimple size={20} />
    </button>
  );
}

export function SidebarScrim({ isOpen, onClose }) {
  return (
    <button
      aria-label="关闭导航"
      className={isOpen ? "sidebar-scrim is-open" : "sidebar-scrim"}
      onClick={onClose}
      tabIndex={isOpen ? 0 : -1}
      type="button"
    />
  );
}

export function PublicSidebar({ activeNav, isOpen = false, navigate, onClose, setActiveNav, site, user }) {
  return (
    <aside className={isOpen ? "sidebar is-open" : "sidebar"} aria-label="站点导航">
      <button aria-label="关闭导航" className="sidebar-close" onClick={onClose} type="button">
        <X size={20} />
      </button>
      <button className="brand brand-button" onClick={() => navigate("/")} type="button">
        <span className="brand-mark">{site.brand.mark}</span>
        <span>
          <strong>{site.brand.title}</strong>
          <span>{site.brand.subtitle}</span>
        </span>
      </button>

      <nav className="side-nav">
        {site.navItems.map((item) => {
          const Icon = navIcons[item] || FileText;
          return (
            <button
              aria-current={activeNav === item ? "page" : undefined}
              className={activeNav === item ? "is-active" : ""}
              key={item}
              onClick={() => {
                setActiveNav(item);
                onClose();
                if (window.location.pathname !== "/") navigate("/");
              }}
              type="button"
            >
              <Icon size={18} />
              <span>{item}</span>
            </button>
          );
        })}
      </nav>

      <div className="writing-state">
        <p>WRITING STATE</p>
        <span>{site.writingState}</span>
      </div>
      {!site.readOnly && <div className="sidebar-actions">
        <button onClick={() => navigate(user ? "/admin" : "/login")} type="button">
          <LockKey size={17} />
          <span>{user ? "进入后台" : "管理员登录"}</span>
        </button>
      </div>}
    </aside>
  );
}
