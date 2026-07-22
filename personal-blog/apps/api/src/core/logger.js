import { getConfig } from "../config.js";

const levels = { debug: 10, info: 20, warn: 30, error: 40 };

function shouldLog(level) {
  return levels[level] >= (levels[getConfig().logLevel] || levels.info);
}

function write(level, event, metadata = {}) {
  if (!shouldLog(level)) return;

  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...metadata,
  });

  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export const logger = {
  debug: (event, metadata) => write("debug", event, metadata),
  error: (event, metadata) => write("error", event, metadata),
  info: (event, metadata) => write("info", event, metadata),
  warn: (event, metadata) => write("warn", event, metadata),
};
