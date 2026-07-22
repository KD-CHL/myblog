import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

const processes = [
  ["api", ["run", "dev:api"]],
  ["web", ["run", "dev:web"]],
].map(([name, args]) => {
  const child = spawn("npm", args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      FORCE_COLOR: "1",
    },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown();
    }
  });

  return child;
});

function shutdown() {
  for (const child of processes) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
