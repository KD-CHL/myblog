import { useEffect, useState } from "react";
import { fetchCurrentUser, logoutAdmin } from "./api.js";
import { getInitialTheme, THEME_STORAGE_KEY } from "./app/hooks.js";
import { useRouter } from "./app/router.js";
import { AdminArea } from "./features/admin/AdminArea.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";
import { PostPage } from "./pages/PostPage.jsx";

export function App() {
  const { navigate, route } = useRouter();
  const [isDark, setIsDark] = useState(getInitialTheme);
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading");

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
    setIsDark,
    setUser,
    user,
  };

  if (route.name === "login") return <LoginPage {...commonProps} next={route.next} />;
  if (route.name.startsWith("admin")) return <AdminArea {...commonProps} route={route} />;
  if (route.name === "post") return <PostPage {...commonProps} slug={route.slug} />;
  if (route.name === "not-found") return <NotFoundPage {...commonProps} />;
  return <HomePage {...commonProps} />;
}
