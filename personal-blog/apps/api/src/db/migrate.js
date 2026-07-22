import { closeDatabase } from "./client.js";
import { getDatabaseHealth, initializeDatabase } from "./bootstrap.js";

try {
  await initializeDatabase();
  const health = await getDatabaseHealth();
  console.log(JSON.stringify({ ok: true, ...health }, null, 2));
} finally {
  closeDatabase();
}
