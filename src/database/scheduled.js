import { initializeDatabase } from "./database.js";
import { notifyDataChanged } from "./events.js";
import { addExpense } from "./expenses.js";
import { addDays, parseISODate, startOfDay, toISODate } from "../utils/date.js";

const RECURRENCE_TYPES = new Set(["monthly", "yearly", "interval"]);

// A scheduled expense can never run before its start date, so any occurrence
// earlier than that is out of scope by construction.
const MAX_CATCH_UP_OCCURRENCES = 10_000;

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function clampDay(year, month, day) {
  return Math.min(Math.max(Number(day) || 1, 1), daysInMonth(year, month));
}

function normalizeScheduled(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    title: row.title,
    category: row.category,
    amount: Number(row.amount),
    notes: row.notes ?? "",
    recurrenceType: row.recurrence_type,
    dayOfMonth: row.day_of_month === null ? null : Number(row.day_of_month),
    monthOfYear:
      row.month_of_year === null ? null : Number(row.month_of_year),
    intervalDays:
      row.interval_days === null ? null : Number(row.interval_days),
    startDate: row.start_date ?? null,
    lastRunDate: row.last_run_date ?? null,
    createdAt: row.created_at,
  };
}

function resolveStartDate(startDate) {
  return startOfDay(parseISODate(startDate) ?? new Date());
}

function assertValidDayOfMonth(dayOfMonth) {
  const day = Number(dayOfMonth);

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(
      "A scheduled expense needs a day of month between 1 and 31.",
    );
  }
}

function assertValidMonthOfYear(monthOfYear) {
  const month = Number(monthOfYear);

  if (!Number.isInteger(month) || month < 0 || month > 11) {
    throw new Error("A scheduled expense needs a valid month.");
  }
}

function assertValidIntervalDays(intervalDays) {
  const interval = Number(intervalDays);

  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error(
      "A scheduled expense needs an interval of at least 1 day.",
    );
  }
}

function assertValidInput({ title, category, amount }) {
  if (!title?.trim()) {
    throw new Error("A scheduled expense needs a title.");
  }

  if (!category) {
    throw new Error("A scheduled expense needs a category.");
  }

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new Error("A scheduled expense needs a positive amount.");
  }
}

export async function getScheduledExpenses() {
  const db = await initializeDatabase();
  const result = await db.query(
    "SELECT * FROM scheduled_expenses ORDER BY created_at ASC, id ASC;",
  );

  return (result.values ?? []).map(normalizeScheduled);
}

async function getScheduledExpenseById(id) {
  const db = await initializeDatabase();
  const result = await db.query(
    "SELECT * FROM scheduled_expenses WHERE id = ? LIMIT 1;",
    [id],
  );

  return normalizeScheduled(result.values?.[0]);
}

export async function addScheduledExpense({
  title,
  category,
  amount,
  notes,
  recurrenceType,
  dayOfMonth,
  monthOfYear,
  intervalDays,
  startDate,
}) {
  assertValidInput({ title, category, amount });

  const type = recurrenceType || "monthly";

  if (!RECURRENCE_TYPES.has(type)) {
    throw new Error("Unknown recurrence type.");
  }

  if (type === "interval") {
    assertValidIntervalDays(intervalDays);
  } else {
    assertValidDayOfMonth(dayOfMonth);
  }

  if (type === "yearly") {
    assertValidMonthOfYear(monthOfYear);
  }

  // Guardrail: schedules only register from today onwards, never retroactively.
  const start = resolveStartDate(startDate);

  if (start < startOfDay(new Date())) {
    throw new Error("The start date must be today or later.");
  }

  const db = await initializeDatabase();
  const now = new Date().toISOString();

  const result = await db.run(
    `INSERT INTO scheduled_expenses
      (title, category, amount, notes, recurrence_type, day_of_month, month_of_year, interval_days, start_date, last_run_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?);`,
    [
      title.trim(),
      category,
      Number(amount),
      notes?.trim() ? notes.trim() : null,
      type,
      type === "interval" ? null : Number(dayOfMonth),
      type === "yearly" ? Number(monthOfYear) : null,
      type === "interval" ? Number(intervalDays) : null,
      toISODate(start),
      now,
    ],
  );

  notifyDataChanged();

  return getScheduledExpenseById(Number(result.changes?.lastId));
}

export async function updateScheduledExpense(id, changes) {
  const db = await initializeDatabase();
  const existing = await getScheduledExpenseById(id);

  if (!existing) {
    throw new Error("That scheduled expense no longer exists.");
  }

  const fields = [];
  const params = [];

  const setField = (column, value) => {
    fields.push(`${column} = ?`);
    params.push(value);
  };

  if (changes.title !== undefined) {
    if (!changes.title?.trim()) {
      throw new Error("A scheduled expense needs a title.");
    }
    setField("title", changes.title.trim());
  }

  if (changes.category !== undefined) {
    if (!changes.category) {
      throw new Error("A scheduled expense needs a category.");
    }
    setField("category", changes.category);
  }

  if (changes.amount !== undefined) {
    if (
      !Number.isFinite(Number(changes.amount)) ||
      Number(changes.amount) <= 0
    ) {
      throw new Error("A scheduled expense needs a positive amount.");
    }
    setField("amount", Number(changes.amount));
  }

  if (changes.notes !== undefined) {
    setField("notes", changes.notes?.trim() ? changes.notes.trim() : null);
  }

  if (changes.recurrenceType !== undefined) {
    if (!RECURRENCE_TYPES.has(changes.recurrenceType)) {
      throw new Error("Unknown recurrence type.");
    }
    setField("recurrence_type", changes.recurrenceType);
  }

  if (changes.dayOfMonth !== undefined) {
    if (changes.dayOfMonth !== null) {
      assertValidDayOfMonth(changes.dayOfMonth);
    }
    setField(
      "day_of_month",
      changes.dayOfMonth === null ? null : Number(changes.dayOfMonth),
    );
  }

  if (changes.monthOfYear !== undefined) {
    if (changes.monthOfYear !== null) {
      assertValidMonthOfYear(changes.monthOfYear);
    }
    setField(
      "month_of_year",
      changes.monthOfYear === null ? null : Number(changes.monthOfYear),
    );
  }

  if (changes.intervalDays !== undefined) {
    if (changes.intervalDays !== null) {
      assertValidIntervalDays(changes.intervalDays);
    }
    setField(
      "interval_days",
      changes.intervalDays === null ? null : Number(changes.intervalDays),
    );
  }

  if (changes.startDate !== undefined) {
    const nextStart = resolveStartDate(changes.startDate);
    const existingStartParsed = existing.startDate
      ? parseISODate(existing.startDate)
      : null;
    const existingStart = existingStartParsed
      ? startOfDay(existingStartParsed)
      : null;
    const unchanged =
      existingStart !== null && nextStart.getTime() === existingStart.getTime();

    // Guardrail on edits: the start date may only move to today or later.
    // Leaving it untouched is always allowed, even for older schedules.
    if (!unchanged && nextStart < startOfDay(new Date())) {
      throw new Error("The start date must be today or later.");
    }

    setField("start_date", toISODate(nextStart));
  }

  if (changes.lastRunDate !== undefined) {
    setField("last_run_date", changes.lastRunDate || null);
  }

  if (fields.length === 0) {
    return existing;
  }

  params.push(id);

  await db.run(
    `UPDATE scheduled_expenses SET ${fields.join(", ")} WHERE id = ?;`,
    params,
  );

  notifyDataChanged();

  return getScheduledExpenseById(id);
}

export async function deleteScheduledExpense(id) {
  const db = await initializeDatabase();
  const result = await db.run(
    "DELETE FROM scheduled_expenses WHERE id = ?;",
    [id],
  );

  notifyDataChanged();

  return (result.changes?.changes ?? 0) > 0;
}

/**
 * Every due occurrence on the recurrence grid between the high-water mark and
 * today. The high-water mark is `last_run_date`; for a schedule that has never
 * run it is the day before `start_date`, so the first run can emit at most
 * today's occurrence and never backfills past dates.
 */
function computeDueDates(item, today) {
  const due = [];
  const todayISO = toISODate(today);
  const start = parseISODate(item.startDate) ?? today;
  const floor = item.lastRunDate
    ? parseISODate(item.lastRunDate)
    : addDays(start, -1);

  const pushIfDue = (date) => {
    const iso = toISODate(date);

    if (date > floor && iso <= todayISO) {
      due.push(iso);
    }
  };

  if (item.recurrenceType === "monthly") {
    const day = Number(item.dayOfMonth) || 1;
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    let guard = 0;

    while (cursor <= today && guard < MAX_CATCH_UP_OCCURRENCES) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();

      pushIfDue(new Date(year, month, clampDay(year, month, day)));

      cursor = new Date(year, month + 1, 1);
      guard += 1;
    }
  } else if (item.recurrenceType === "yearly") {
    const month = Number(item.monthOfYear ?? 0);
    const day = Number(item.dayOfMonth) || 1;

    for (let year = start.getFullYear(); year <= today.getFullYear(); year += 1) {
      pushIfDue(new Date(year, month, clampDay(year, month, day)));
    }
  } else if (item.recurrenceType === "interval") {
    const interval = Math.max(Number(item.intervalDays) || 1, 1);
    let cursor = start;
    let guard = 0;

    while (cursor <= today && guard < MAX_CATCH_UP_OCCURRENCES) {
      pushIfDue(cursor);

      cursor = addDays(cursor, interval);
      guard += 1;
    }
  }

  return due;
}

// Serialize scheduler runs so concurrent calls (e.g. React StrictMode double
// mount) cannot both read the old last_run_date and insert duplicates.
let runningPromise = null;

/**
 * Register every scheduled expense that fell due since its last run, then
 * advance last_run_date. Resolves with the list of inserted expenses so the
 * UI can tell the user what was auto-registered.
 */
export function runScheduler() {
  if (runningPromise) {
    return runningPromise;
  }

  const task = (async () => {
    const items = await getScheduledExpenses();
    const today = startOfDay(new Date());
    const inserted = [];

    for (const item of items) {
      const dueDates = computeDueDates(item, today);

      for (const date of dueDates) {
        const expense = await addExpense({
          date,
          category: item.category,
          amount: item.amount,
          notes: item.notes?.trim() ? item.notes : item.title,
        });

        inserted.push(expense);
      }

      if (dueDates.length > 0) {
        await updateScheduledExpense(item.id, {
          lastRunDate: dueDates[dueDates.length - 1],
        });
      }
    }

    if (inserted.length > 0) {
      notifyDataChanged();
    }

    return inserted;
  })();

  runningPromise = task;

  // Clear the lock once finished (success or failure) so future opens can run.
  const clear = () => {
    if (runningPromise === task) {
      runningPromise = null;
    }
  };

  task.then(clear, clear);

  return task;
}
