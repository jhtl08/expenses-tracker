# PLAN — Expense Tracker: SQLite CRUD, Persistent Memory, OverviewPage

## Context

This is a Capacitor + React + Vite mobile expense tracker (Android target).
`@capacitor-community/sqlite` is configured in `capacitor.config.json`
(`CapacitorSQLite`, no encryption) and `android/` is set up.

Intended outcome (per user request):

1. Complete SQLite CRUD service for local mobile storage.
2. Persistent memory for config across runs: shortcut order/positioning,
   OverviewPage filter state, and user-managed categories (add/modify/delete,
   persisted).
3. Finish OverviewPage with date-range filtering (previous month / 3 months /
   1 year / custom start–end), total spend, horizontal stacked bar per
   category, stacked bar per category over time (day/month toggle), plus other
   useful stats.

## Approach (implemented)

- **Database**: a single SQLite database (`expense_tracker`, version 2) opened
  through `initializeDatabase()`. Schema creation and migrations run for both
  native and web connections. Tables: `expenses`, `settings`, `categories`.
- **Persistent config**: the `settings` table stores JSON key/value rows for
  shortcuts (`shortcuts.v1`) and OverviewPage filters
  (`overview.filters.v1`). No `@capacitor/preferences` dependency.
- **Categories**: a real `categories` table (not JSON), so rename/delete can
  follow through to historical expenses safely. Seed categories are inserted
  with `INSERT OR IGNORE`; expenses pointing at unknown categories are
  backfilled into the table. `Other` is protected: it cannot be deleted or
  renamed, and deleting any category reassigns its expenses to `Other`.
- **Web / dev**: `database.js` uses a `sql.js` adapter (`webDatabase.js`) that
  mirrors the plugin's `execute` / `run` / `query` API and persists the
  database to `localStorage`, so `npm run dev` and `vite preview` exercise the
  same services as mobile. Native Android uses
  `@capacitor-community/sqlite`.
- **Charts**: `chart.js` 4 + `react-chartjs-2` 5.
- **Shortcut taps**: wired to `addExpense()` using the selected date.
- **Refresh**: services call `notifyDataChanged()`; `useDataVersion()` /
  `useCategories()` hooks re-run page queries after writes.

### Range presets and granularity

- Presets: This Month, Last Month, Last 3 Months, Last 12 Months,
  Last 3 Years, Custom.
- The stacked time chart auto-selects "month" when the range is longer than
  62 days; the day/month toggle overrides until the range changes.
- Filters are saved to the `settings` table whenever they change and restored
  on startup.

## Files

- `src/database/database.js` — connection singleton, web/native selection,
  schema creation, expense migration, category seeding/backfill.
- `src/database/webDatabase.js` — sql.js + localStorage adapter for web.
- `src/database/defaults.js` — default categories/shortcuts, protected name,
  colour palette.
- `src/database/expenses.js` — add/read/update/delete, range/category queries,
  SQL category totals.
- `src/database/settings.js` — JSON key/value settings.
- `src/database/categories.js` — category CRUD, rename/delete reassignment,
  protected-name guards.
- `src/database/shortcuts.js` — persisted shortcut list and defaults.
- `src/database/events.js` — `notifyDataChanged()` + subscriptions.
- `src/hooks/useDatabase.js` — `useDataVersion`, `useCategories`.
- `src/utils/date.js` — local ISO date maths, presets, granularity.
- `src/utils/format.js` — money/percent formatting.
- `src/utils/analytics.js` — range aggregation and stacked series.
- `src/components/OverviewPage.jsx` — filters, stats, transactions with
  pagination and two-click inline delete.
- `src/components/ExpenseCharts.jsx` — horizontal stacked category bar and
  stacked category-over-time chart.
- `src/components/CategoryManager.jsx` — add/rename/delete modal.
- `src/components/Components.jsx` — `Modal`, `ColorPicker`.
- `src/components/EntryPage.jsx` — persisted categories + category manager,
  latest-5 recent transactions with edit/update and two-click delete.
- `src/components/ShortcutsPage.jsx` — persisted shortcuts, tap-to-add,
  drag reorder (with drop-target highlight), category manager.
- `src/App.jsx` — database init with loading / error / retry screens.

## Steps

### Phase 1 — Database CRUD service
- [x] 1.1 Add a persistent web fallback (`sql.js` + localStorage) so
  `npm run dev` works like mobile without `jeep-sqlite`.
- [x] 1.2 Create `settings` and `categories` tables; migrate `expenses` to add
  `updated_at`; seed defaults; backfill categories from expenses.
- [x] 1.3 Add `getExpenses`, `getExpenseById`, `updateExpense`,
  `deleteExpense`, `getExpensesByRange`, `getExpensesByCategory`,
  `getExpenseTotalsByCategory`, `deleteAllExpenses`.
- [x] 1.4 Wire `ShortcutsPage` add-expense taps to `addExpense`.
- [x] 1.5 Verified with browser end-to-end tests and an Android debug build.

### Phase 2 — Persistent memory (config)
- [x] 2.1 `settings.js` with `getSetting` / `setSetting` / `removeSetting`.
- [x] 2.2 `categories.js` with CRUD; delete reassigns expenses to `Other`;
  rename updates historical expense rows; reserved-name guards.
- [x] 2.3 Shortcuts load on mount and save on add/edit/delete/reorder.
- [x] 2.4 OverviewPage range + custom dates persist across reloads.
- [x] 2.5 Category management UI shared by Entry and Shortcuts.
- [x] 2.6 Verified config and categories survive reload and stay in sync
  across pages.

### Phase 3 — OverviewPage analytics
- [x] 3.1 Add `chart.js` + `react-chartjs-2`.
- [x] 3.2 Range controls (This Month, Last Month, Last 3 Months,
  Last 12 Months, Last 3 Years, Custom start–end).
- [x] 3.3 Query expenses for the range and compute total, category totals,
  day/month series, and previous-period comparison.
- [x] 3.4 Horizontal stacked category bar with legend and percentages.
- [x] 3.5 Stacked category-over-time chart with day/month toggle.
- [x] 3.6 Extra stats: transactions, average/day, average/expense, top
  category, largest expense, top spending day, active days, recent
  transactions with delete.
- [x] 3.7 Verified filters persist and charts render with filtered data.

### Phase 4 — Transaction list ergonomics
- [x] 4.1 Overview transactions paginate 10 per page (Previous / Next,
  "Page X / Y", "Showing A–B of N"); page resets on range changes and clamps
  when rows are deleted.
- [x] 4.2 Overview delete uses the same two-click inline `Confirm?` pattern
  as category delete (no `window.confirm`).
- [x] 4.3 Entry shows the 5 most recent transactions across all dates.
- [x] 4.4 Entry Edit loads date, category, amount, and notes back into the
  form; the submit button becomes "Update Expense" and updates the existing
  row instead of inserting.
- [x] 4.5 Entry delete uses inline confirmation; the list reloads so the next
  latest transaction fills the gap.
- [x] 4.6 Each page scrolls independently: the shell is a `h-dvh` strip so
  every page section is exactly one viewport tall (`min-h-full` pages), so
  Entry/Shortcuts are no longer stretched to the Overview height.
- [x] 4.7 Verified with browser end-to-end tests (see below).

## Verification

- `npm run lint` passes.
- `npm run build` succeeds.
- `npx cap sync android` succeeds; `@capacitor-community/sqlite@8.1.1` is
  registered.
- `.\gradlew.bat :app:assembleDebug` (JDK 21+ / Android Studio JBR) succeeds.
- Headless Chromium/Edge end-to-end run against `vite preview` (56 checks):
  - add expense via Entry and via shortcut, totals/count/list update;
  - both charts render non-blank canvases;
  - expenses, shortcuts, and Overview filters survive reload;
  - add/rename/delete category; `Other` rename is blocked; deleting a
    category moves its expenses to `Other`;
  - renaming a category updates shortcuts that use it;
  - deleted default categories are not re-seeded on restart;
  - add shortcut; long-press drag reorders shortcuts with drop-target
    highlight; new order persists after reload;
  - Entry edit fills date/category/amount/notes and Update Expense rewrites
    the row without adding a duplicate;
  - Entry delete requires two clicks and pulls the next latest expense in;
  - the recent list is capped at 5 across all dates;
  - Overview paginates 10 per page, Next/Previous move pages, deleting on the
    last page keeps/clamps the page correctly, and delete requires a second
    click;
  - no horizontal overflow, and the recent-row actions plus the pager stay
    inside a 430 px viewport;
  - the shell does not scroll: every page section is exactly one viewport
    tall, and short pages are not stretched to the Overview height.
- Remaining device-only check: run the APK on a device/emulator and repeat
  the create/read/update/delete flow against native SQLite (the web path
  cannot substitute for the native plugin at runtime).

## Decisions

1. Charts: `chart.js` + `react-chartjs-2`.
2. Persistent config: SQLite `settings` table (no `@capacitor/preferences`).
3. Web/dev mode: `sql.js` + localStorage so browser testing persists.
4. Categories: dedicated SQL table, with `Other` protected and safe
   reassignment on delete.
5. Shortcut taps insert a real expense for the selected date.
