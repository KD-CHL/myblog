import { useCallback, useEffect, useState } from "react";

export function getRouteFromLocation() {
  const { pathname, search } = window.location;
  const loginNext = new URLSearchParams(search).get("next") || "/admin";
  const postMatch = pathname.match(/^\/posts\/([^/]+)$/);
  const tagMatch = pathname.match(/^\/tags\/([^/]+)$/);
  const editMatch = pathname.match(/^\/admin\/posts\/([^/]+)\/edit$/);

  if (pathname === "/login") return { name: "login", next: loginNext };
  if (pathname === "/admin") return { name: "admin" };
  if (pathname === "/admin/posts/new") return { name: "admin-new" };
  if (pathname === "/admin/settings") return { name: "admin-settings" };
  if (pathname === "/admin/audit") return { name: "admin-audit" };
  if (pathname === "/admin/subscriptions") return { name: "admin-subscriptions" };
  if (pathname === "/admin/comments") return { name: "admin-comments" };
  if (editMatch) return { name: "admin-edit", id: decodeURIComponent(editMatch[1]) };
  if (postMatch) return { name: "post", slug: decodeURIComponent(postMatch[1]) };
  if (pathname === "/tags") return { name: "tags" };
  if (tagMatch) return { name: "tags", tag: decodeURIComponent(tagMatch[1]) };
  if (pathname === "/") return { name: "home" };
  return { name: "not-found" };
}

export function useRouter() {
  const [route, setRoute] = useState(getRouteFromLocation);

  useEffect(() => {
    const handlePopState = () => setRoute(getRouteFromLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    window.history[replace ? "replaceState" : "pushState"]({}, "", to);
    setRoute(getRouteFromLocation());
    window.scrollTo(0, 0);
  }, []);

  return { navigate, route };
}
