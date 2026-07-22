import { useEffect, useState } from "react";
import { fetchCurrentUser, logoutAdmin } from "./api.js";
import { getInitialTheme, THEME_STORAGE_KEY } from "./app/hooks.js";
import { useRouter } from "./app/router.js";
import { AdminArea } from "./features/admin/AdminArea.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";
import { PostPage } from "./pages/PostPage.jsx";
import { TagPage } from "./pages/TagPage.jsx";
import { BackToTop } from "./shared/components/BackToTop.jsx";
import { SearchOverlay } from "./shared/components/SearchOverlay.jsx";

export function App() {
  const { navigate, route } = useRouter();
  const [isDark, setIsDark] = useState(getInitialTheme);
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const theme = isDark ? "dark" : "light";
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [isDark]);

  useEffect(() => {
    let ignore = false;
    fetchCurrentUser()
      .then((payload) => {
        if (!ignore) setUser(payload.user);
      })
      .catch(() => {
        if (!ignore) setUser(null);
      })
      .finally(() => {
        if (!ignore) setAuthStatus("ready");
      });
    return () => {
      ignore = true;
    };
  }, []);

  /* Global ⌘K / Ctrl+K opens the search overlay.
     Home keeps its own inline ⌘K focus behavior; login/admin are skipped. */
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      if (["home", "login"].includes(route.name) || route.name.startsWith("admin")) return;
      event.preventDefault();
      setIsSearchOpen((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [route.name]);

  async function handleLogout() {
    try {
      await logoutAdmin();
    } finally {
      setUser(null);
      navigate("/");
    }
  }

  const commonProps = {
    authStatus,
    isDark,
    navigate,
    onLogout: handleLogout,
    onOpenSearch: () => setIsSearchOpen(true),
    setIsDark,
    setUser,
    user,
  };

  let page;
  if (route.name === "login") page = <LoginPage {...commonProps} next={route.next} />;
  else if (route.name.startsWith("admin")) page = <AdminArea {...commonProps} route={route} />;
  else if (route.name === "post") page = <PostPage {...commonProps} slug={route.slug} />;
  else if (route.name === "tags") page = <TagPage {...commonProps} tag={route.tag} />;
  else if (route.name === "not-found") page = <NotFoundPage {...commonProps} />;
  else page = <HomePage {...commonProps} />;

  return (
    <>
      {page}
      <SearchOverlay navigate={navigate} onClose={() => setIsSearchOpen(false)} open={isSearchOpen} />
      <BackToTop />
    </>
  );
}
