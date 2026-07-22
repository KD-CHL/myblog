import { ArrowLeft, House } from "@phosphor-icons/react";
import { useState } from "react";
import { useBodyScrollLock, useDocumentTitle } from "../app/hooks.js";
import { fallbackSite } from "../shared/site.js";
import { MenuButton, PublicSidebar, SidebarScrim, ThemeButton } from "../shared/components/Navigation.jsx";

export function NotFoundPage({ isDark, navigate, setIsDark, user }) {
  useDocumentTitle("页面不存在 | Knowledge Log");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useBodyScrollLock(isMenuOpen);

  return (
    <main className={isDark ? "app article-app app-dark" : "app article-app"}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <PublicSidebar activeNav="总览" isOpen={isMenuOpen} navigate={navigate} onClose={() => setIsMenuOpen(false)} setActiveNav={() => undefined} site={fallbackSite} user={user} />
      <SidebarScrim isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <section className="workspace article-workspace" id="main-content" tabIndex={-1}>
        <header className="topbar article-topbar"><div className="topbar-leading"><MenuButton onClick={() => setIsMenuOpen(true)} /><button className="icon-text-button" onClick={() => navigate("/")} type="button"><ArrowLeft size={18} />返回首页</button></div><ThemeButton isDark={isDark} setIsDark={setIsDark} /></header>
        <article className="article-page not-found-page"><span className="post-kind">404</span><h1>页面不存在</h1><p className="article-excerpt">这个地址没有对应的文章或后台页面，可以回到首页继续浏览。</p><button className="primary-action" onClick={() => navigate("/")} type="button"><House size={18} />回到首页</button></article>
      </section>
    </main>
  );
}
