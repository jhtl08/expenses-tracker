# PLAN — Import/Export, Bulk Delete, and Scheduled Expenses

## Context

The Expense Tracker already has per-expense CRUD, a date-range Overview, and
persistent settings in SQLite. Three features are requested:

1. **CSV import and export for the selected Overview range.**
2. **Delete all expenses in the selected range**, with a confirmation warning.
3. **Scheduled expenses**: a template that registers an expense on a recurring
   rule (monthly day-of-month, annual day+month, or every-N-days). On app open,
   any occurrences that fell due since the last run are inserted, including
   multiple missed occurrences.

## Approach

### CSV export
- Add `exportExpensesToCsv(expenses)` in `src/utils/csv.js` that builds a
  CSV string (`Date,Category,Amount,Notes`) with proper quoting and triggers a
  browser download via `Blob` + `URL.createObjectURL`.
- The Overview uses its already-loaded `expenses` for the selected range, so no
  extra query is needed. Button disabled when the range is empty.

### CSV import
- Add `parseCsv(text)` in the same utility, returning validated rows
  `{ date, category, amount, notes }`. Invalid rows are collected as errors.
- Import inserts each valid row through `addExpense`. Unknown categories are
  auto-created with `addCategory` using `FALLBACK_CATEGORY_COLOR` (per user
  choice), so imports never fail on a category name.
- A summary message reports imported / skipped counts. `notifyDataChanged()`
  refreshes all pages.

### Delete all in range
- Add `deleteExpensesByRange(start, end)` to `src/database/expenses.js`
  (SQL `DELETE ... WHERE date BETWEEN ? AND ?`), then `notifyDataChanged()`.
- Overview gets a "Delete all in range" button. First click arms a
  confirmation panel showing the count and a warning; second click (or a
  Confirm button) performs the delete. Cancel clears the armed state.
  Page resets to 0.

### Scheduled expenses
- New table `scheduled_expenses` (see schema below), created in
  `database.js` and seeded empty. Schema version stays compatible (CREATE
  TABLE IF NOT EXISTS).
- Service `src/database/scheduled.js` with CRUD plus `runScheduler()`.
- `runScheduler()` is called from `App.jsx` after `initializeDatabase()`
  resolves. For each scheduled item it computes every due occurrence between
  `last_run_date` (or `start_date` for intervals) and today and inserts one
  expense per occurrence, then updates `last_run_date` to the last inserted
  date. This catches up multiple missed runs in one pass.
- Recurrence rules:
  - `monthly`: day-of-month, clamped to the month's last day.
  - `yearly`: month (0–11) + day-of-month, clamped.
  - `interval`: every N days from `start_date`.
- Management UI is a `ScheduledManager` modal opened from the Shortcuts page,
  mirroring `CategoryManager` (add / edit / delete, two-click delete).

### Better-way note (documented in README)
The on-open catch-up approach is the only reliable option for a Capacitor web
app: Android doze and the lack of a background runtime mean the app cannot
guarantee execution while closed, and web has no background tasks at all.
`runScheduler()` on startup is therefore the primary mechanism. A future
enhancement could add `@capacitor/local-notifications` to remind the user, but
auto-insert still only happens when the app is opened.

## Files to modify

- `src/database/database.js` — add `scheduled_expenses` to `SCHEMA_STATEMENTS`.
- `src/database/expenses.js` — add `deleteExpensesByRange`.
- `src/database/scheduled.js` — new service (CRUD + scheduler).
- `src/utils/csv.js` — new utility (parse + export download).
- `src/components/OverviewPage.jsx` — Export CSV, Import CSV, Delete all in range.
- `src/components/ScheduledManager.jsx` — new modal.
- `src/components/ShortcutsPage.jsx` — button to open ScheduledManager.
- `src/App.jsx` — call `runScheduler()` after DB init; surface count of
  auto-registered expenses in the loading/ready transition (optional toast).
- `README.md` — document CSV and scheduled expenses.

## Reuse

- `addExpense`, `getExpensesByRange`, `deleteExpense` in `src/database/expenses.js`.
- `addCategory` in `src/database/categories.js` for auto-creating categories.
- `notifyDataChanged` / `useDataVersion` for refresh.
- `Modal`, `FormField` in `src/components/Components.jsx`.
- `useCategories` in `src/hooks/useDatabase.js`.
- Date helpers in `src/utils/date.js` (`parseISODate`, `toISODate`,
  `startOfMonth`, `endOfMonth`, `addDays`).

## Schema: scheduled_expenses

```
CREATE TABLE IF NOT EXISTS scheduled_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  notes TEXT,
  recurrence_type TEXT NOT NULL,   -- 'monthly' | 'yearly' | 'interval'
  day_of_month INTEGER,
  month_of_year INTEGER,          -- 0-11, yearly only
  interval_days INTEGER,          -- interval only
  start_date TEXT,                -- ISO, interval anchor
  last_run_date TEXT,             -- ISO, last occurrence processed
  created_at TEXT NOT NULL
);
```

## Steps

### Phase 1 — CSV export / import
- [x] 1.1 Create `src/utils/csv.js` with `toCsv` and `parseCsv`.
- [x] 1.2 Add Export CSV button to Overview (uses current range expenses).
- [x] 1.3 Add Import CSV file input + summary message; auto-create categories.
- [x] 1.4 Lint and build.

### Phase 2 — Bulk delete
- [x] 2.1 Add `deleteExpensesByRange(start, end)` to `expenses.js`.
- [x] 2.2 Add Delete-all-in-range button with armed confirmation panel.
- [x] 2.3 Reset page and refresh after delete.

### Phase 3 — Scheduled expenses
- [x] 3.1 Add `scheduled_expenses` table to schema.
- [x] 3.2 Implement `src/database/scheduled.js` (CRUD + `runScheduler`).
- [x] 3.3 Call `runScheduler()` from `App.jsx` after DB init; notify on inserts.
- [x] 3.4 Implement `ScheduledManager` modal and wire into Shortcuts page.
- [x] 3.5 Lint, build, and manual test catch-up of multiple missed months.

### Phase 4 — Docs
- [x] 4.1 Update README with CSV and scheduled-expense sections.

## Verification

- Export a range with commas/quotes in notes and confirm the CSV parses.
- Import a CSV with a mix of valid and invalid rows; check counts and that
  unknown categories are created.
- Delete-all-in-range cancels on first click and deletes only after confirm;
  verify count and that other ranges are untouched.
- Scheduled: create a monthly item dated in the past, reopen the app, confirm
  one expense per missed month is inserted and `last_run_date` advances.
- `npm run lint` and `npm run build` pass.