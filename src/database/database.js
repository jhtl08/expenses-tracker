import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
import { createWebDatabase } from "./webDatabase.js";
import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY_COLOR } from "./defaults.js";

const DATABASE_NAME = "expense_tracker";
const DATABASE_VERSION = 2;

const sqlite = new SQLiteConnection(CapacitorSQLite);

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category);`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS scheduled_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    notes TEXT,
    recurrence_type TEXT NOT NULL,
    day_of_month INTEGER,
    month_of_year INTEGER,
    interval_days INTEGER,
    start_date TEXT,
    last_run_date TEXT,
    created_at TEXT NOT NULL
  );`,
];

let connection = null;
let initialization = null;

export const isWebPlatform = () => Capacitor.getPlatform() === "web";

async function migrateExpensesTable(db) {
  const result = await db.query("PRAGMA table_info(expenses);");
  const columns = new Set((result.values ?? []).map((column) => column.name));

  if (!columns.has("updated_at")) {
    await db.execute("ALTER TABLE expenses ADD COLUMN updated_at TEXT;");
  }
}

async function seedDefaultCategories(db) {
  // Only seed a brand-new database. Running this on every launch would bring
  // back categories the user intentionally deleted.
  const countResult = await db.query(
    "SELECT COUNT(*) AS count FROM categories;",
  );

  if (Number(countResult.values?.[0]?.count ?? 0) > 0) {
    return;
  }

  const now = new Date().toISOString();

  for (let index = 0; index < DEFAULT_CATEGORIES.length; index += 1) {
    const category = DEFAULT_CATEGORIES[index];

    await db.run(
      `INSERT OR IGNORE INTO categories (name, color, sort_order, created_at)
       VALUES (?, ?, ?, ?);`,
      [category.name, category.color, index, now],
    );
  }
}

// Expenses created before categories became user-managed (or imported data)
// may reference a category that is not in the table yet.
async function backfillCategoriesFromExpenses(db) {
  const now = new Date().toISOString();

  await db.run(
    `INSERT OR IGNORE INTO categories (name, color, sort_order, created_at)
     SELECT DISTINCT category, ?, 1000, ?
     FROM expenses
     WHERE TRIM(category) <> ''
       AND category NOT IN (SELECT name FROM categories);`,
    [FALLBACK_CATEGORY_COLOR, now],
  );
}

async function prepareSchema(db) {
  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(statement);
  }

  await migrateExpensesTable(db);
  await seedDefaultCategories(db);
  await backfillCategoriesFromExpenses(db);
}

async function openNativeDatabase() {
  let consistent = { result: false };

  try {
    consistent = await sqlite.checkConnectionsConsistency();
  } catch {
    // First run: there is nothing to be consistent with.
  }

  const connectionExists = await sqlite.isConnection(DATABASE_NAME, false);

  const db =
    consistent.result && connectionExists.result
      ? await sqlite.retrieveConnection(DATABASE_NAME, false)
      : await sqlite.createConnection(
          DATABASE_NAME,
          false,
          "no-encryption",
          DATABASE_VERSION,
          false,
        );

  await db.open();

  return db;
}

async function openDatabase() {
  if (isWebPlatform()) {
    const db = await createWebDatabase();
    await prepareSchema(db);
    return db;
  }

  const db = await openNativeDatabase();
  await prepareSchema(db);
  return db;
}

export const initializeDatabase = async () => {
  if (connection) {
    return connection;
  }

  if (!initialization) {
    initialization = openDatabase()
      .then((db) => {
        connection = db;
        return db;
      })
      .catch((error) => {
        initialization = null;
        throw error;
      });
  }

  return initialization;
};

/**
 * Close the open connection, e.g. before an intentional full reset.
 * Not used by the UI yet, but keeps the service testable.
 */
export const closeDatabase = async () => {
  if (!connection) {
    return;
  }

  try {
    if (isWebPlatform()) {
      await connection.close();
    } else {
      await sqlite.closeConnection(DATABASE_NAME, false);
    }
  } finally {
    connection = null;
    initialization = null;
  }
};
