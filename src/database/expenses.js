import { initializeDatabase } from "./database.js";
import { notifyDataChanged } from "./events.js";

function normalizeExpense(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    date: row.date,
    category: row.category,
    amount: Number(row.amount),
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

function assertExpenseInput({ date, category, amount }) {
  if (!date) {
    throw new Error("An expense needs a date.");
  }

  if (!category) {
    throw new Error("An expense needs a category.");
  }

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new Error("An expense needs a positive amount.");
  }
}

export async function addExpense({ date, category, amount, notes }) {
  assertExpenseInput({ date, category, amount });

  const db = await initializeDatabase();
  const timestamp = new Date().toISOString();

  const result = await db.run(
    `INSERT INTO expenses (date, category, amount, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      date,
      category,
      Number(amount),
      notes?.trim() ? notes.trim() : null,
      timestamp,
      timestamp,
    ],
  );

  notifyDataChanged();

  return {
    id: Number(result.changes?.lastId),
    date,
    category,
    amount: Number(amount),
    notes: notes?.trim() ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function getExpenses({
  start,
  end,
  category,
  limit,
  offset,
  order = "DESC",
} = {}) {
  const db = await initializeDatabase();
  const conditions = [];
  const params = [];

  if (start) {
    conditions.push("date >= ?");
    params.push(start);
  }

  if (end) {
    conditions.push("date <= ?");
    params.push(end);
  }

  if (category) {
    conditions.push("category = ? COLLATE NOCASE");
    params.push(category);
  }

  const direction = order === "ASC" ? "ASC" : "DESC";
  let sql = "SELECT * FROM expenses";

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  sql += ` ORDER BY date ${direction}, id ${direction}`;

  if (Number.isFinite(Number(limit))) {
    sql += " LIMIT ?";
    params.push(Number(limit));

    if (Number.isFinite(Number(offset))) {
      sql += " OFFSET ?";
      params.push(Number(offset));
    }
  }

  const result = await db.query(sql, params);

  return (result.values ?? []).map(normalizeExpense);
}

export async function getExpensesByRange(start, end) {
  return getExpenses({ start, end });
}

export async function getExpensesByCategory(category) {
  return getExpenses({ category });
}

export async function getExpenseById(id) {
  const db = await initializeDatabase();
  const result = await db.query("SELECT * FROM expenses WHERE id = ? LIMIT 1;", [
    id,
  ]);

  return normalizeExpense(result.values?.[0]);
}

export async function updateExpense(id, changes) {
  const db = await initializeDatabase();
  const fields = [];
  const params = [];

  if (changes.date !== undefined) {
    if (!changes.date) {
      throw new Error("An expense needs a date.");
    }
    fields.push("date = ?");
    params.push(changes.date);
  }

  if (changes.category !== undefined) {
    if (!changes.category) {
      throw new Error("An expense needs a category.");
    }
    fields.push("category = ?");
    params.push(changes.category);
  }

  if (changes.amount !== undefined) {
    if (
      !Number.isFinite(Number(changes.amount)) ||
      Number(changes.amount) <= 0
    ) {
      throw new Error("An expense needs a positive amount.");
    }
    fields.push("amount = ?");
    params.push(Number(changes.amount));
  }

  if (changes.notes !== undefined) {
    fields.push("notes = ?");
    params.push(changes.notes?.trim() ? changes.notes.trim() : null);
  }

  if (fields.length === 0) {
    return getExpenseById(id);
  }

  fields.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(id);

  await db.run(
    `UPDATE expenses SET ${fields.join(", ")} WHERE id = ?;`,
    params,
  );

  notifyDataChanged();

  return getExpenseById(id);
}

export async function deleteExpense(id) {
  const db = await initializeDatabase();
  const result = await db.run("DELETE FROM expenses WHERE id = ?;", [id]);

  notifyDataChanged();

  return (result.changes?.changes ?? 0) > 0;
}

export async function deleteAllExpenses() {
  const db = await initializeDatabase();
  const result = await db.run("DELETE FROM expenses;");

  notifyDataChanged();

  return result.changes?.changes ?? 0;
}

/**
 * Totals grouped by category, computed by SQLite. The Overview page currently
 * aggregates in JavaScript so it can build the time series from a single
 * query, but this is handy for reports and future screens.
 */
export async function getExpenseTotalsByCategory(start, end) {
  const db = await initializeDatabase();
  const conditions = [];
  const params = [];

  if (start) {
    conditions.push("date >= ?");
    params.push(start);
  }

  if (end) {
    conditions.push("date <= ?");
    params.push(end);
  }

  let sql = `SELECT category, SUM(amount) AS total, COUNT(*) AS count
             FROM expenses`;

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  sql += " GROUP BY category ORDER BY total DESC;";

  const result = await db.query(sql, params);

  return (result.values ?? []).map((row) => ({
    category: row.category,
    total: Number(row.total),
    count: Number(row.count),
  }));
}
