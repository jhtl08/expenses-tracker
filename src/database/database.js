import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";

const sqlite = new SQLiteConnection(CapacitorSQLite);

let db;

export const initializeDatabase = async () => {
  if (db) {
    return db;
  }

  if (Capacitor.getPlatform() === "web") {
    throw new Error(
      "SQLite initialization for the web platform has not been configured yet.",
    );
  }

  db = await sqlite.createConnection(
    "expense_tracker",
    false,
    "no-encryption",
    1,
    false,
  );

  await db.open();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  return db;
};
