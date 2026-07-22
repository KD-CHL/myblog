import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "./app.js";
import { getConfig } from "./config.js";
import { logger } from "./core/logger.js";
import { initializeDatabase } from "./db/bootstrap.js";

const currentFile = fileURLToPath(import.meta.url);

export { handleRequest };

async function startServer() {
  const config = getConfig();
  await initializeDatabase();
  const server = http.createServer(handleRequest);
  server.listen(config.port, config.hostname, () => {
    logger.info("server.started", {
      databaseProvider: config.database.provider,
      url: `http://${config.hostname}:${config.port}`,
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  startServer().catch((error) => {
    logger.error("server.start_failed", { message: error.message, stack: error.stack });
    process.exitCode = 1;
  });
}
