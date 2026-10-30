import { initializeDatabase } from "./database.js";

// All configuration that must survive an app restart is stored as JSON in the
// `settings` table. This keeps shortcuts, filters and the categories table in
// the same database as the expenses.

export async function getSetting(key, fallback = null) {
  const db = await initializeDatabase();
  const result = await db.query(
    "SELECT value FROM settings WHERE key = ? LIMIT 1;",
    [key],
  );

  const value = result.values?.[0]?.value;

  if (typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function setSetting(key, value) {
  const db = await initializeDatabase();

  await db.run(
    `INSERT OR REPLACE INTO settings (key, value, updated_at)
     VALUES (?, ?, ?);`,
    [key, JSON.stringify(value), new Date().toISOString()],
  );

  return value;
}

export async function removeSetting(key) {
  const db = await initializeDatabase();
  await db.run("DELETE FROM settings WHERE key = ?;", [key]);
}
