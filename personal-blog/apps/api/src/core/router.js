function compilePattern(pattern) {
  const keys = [];
  const source = pattern
    .split("/")
    .map((segment) => {
      if (!segment.startsWith(":")) return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      keys.push(segment.slice(1));
      return "([^/]+)";
    })
    .join("/");

  return { keys, regex: new RegExp(`^${source}/?$`) };
}

export function createRouter() {
  const routes = [];

  function add(method, pattern, handler, options = {}) {
    routes.push({ handler, method, options, pattern, ...compilePattern(pattern) });
  }

  function match(method, pathname) {
    for (const route of routes) {
      if (route.method !== method) continue;
      const matchResult = pathname.match(route.regex);
      if (!matchResult) continue;

      const params = Object.fromEntries(
        route.keys.map((key, index) => [key, decodeURIComponent(matchResult[index + 1])]),
      );
      return { ...route, params };
    }

    return null;
  }

  return { add, match };
}
