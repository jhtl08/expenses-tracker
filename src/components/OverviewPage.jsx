import { useEffect, useMemo, useRef, useState } from "react";
import { Footer, Modal } from "./Components.jsx";
import { CategoryBreakdownChart, CategoryTimeChart } from "./ExpenseCharts.jsx";
import { getCategories } from "../database/categories.js";
import {
  deleteExpense,
  deleteExpensesByRange,
  getExpensesByRange,
} from "../database/expenses.js";
import { addCategory } from "../database/categories.js";
import { addExpense } from "../database/expenses.js";
import { downloadCsv, parseCsv, toCsv } from "../utils/csv.js";
import { getSetting, setSetting } from "../database/settings.js";
import { useDataVersion } from "../hooks/useDatabase.js";
import { buildOverview, sumExpenses } from "../utils/analytics.js";
import {
  RANGE_PRESETS,
  formatDateLabel,
  getAutoGranularity,
  getPresetRange,
  getPreviousRange,
  parseISODate,
  toISODate,
} from "../utils/date.js";
import { formatMoney, formatPercent } from "../utils/format.js";

const FILTERS_KEY = "overview.filters.v1";
const PAGE_SIZE = 10;

function normalizeFilters(saved) {
  const today = new Date();
  const preset = RANGE_PRESETS.some((item) => item.id === saved?.preset)
    ? saved.preset
    : "this-month";

  return {
    preset,
    customStart:
      parseISODate(saved?.customStart) !== null
        ? saved.customStart
        : toISODate(today),
    customEnd:
      parseISODate(saved?.customEnd) !== null
        ? saved.customEnd
        : toISODate(today),
  };
}

function StatCard({ label, value, hint }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-[#111418] p-3.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1.5 truncate text-base font-semibold tabular-nums text-zinc-100">
        {value}
      </p>
      {hint && (
        <p className="mt-1 truncate text-[11px] leading-relaxed text-zinc-600">
          {hint}
        </p>
      )}
    </div>
  );
}

function DeltaBadge({ delta, percent }) {
  if (percent === null) {
    return (
      <span className="text-xs text-zinc-500">
        No spending in the previous period
      </span>
    );
  }

  if (Math.abs(percent) < 0.05) {
    return (
      <span className="text-xs text-zinc-500">Same as previous period</span>
    );
  }

  const increased = delta > 0;

  return (
    <span
      className={`text-xs font-medium ${
        increased ? "text-red-300" : "text-emerald-300"
      }`}
    >
      {increased ? "▲" : "▼"} {formatPercent(Math.abs(percent))}
      <span className="ml-1 font-normal text-zinc-500">vs previous period</span>
    </span>
  );
}

export function Overview() {
  const version = useDataVersion();
  const [today] = useState(() => new Date());
  const [filters, setFilters] = useState(null);
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [previousExpenses, setPreviousExpenses] = useState([]);
  const [granularityOverride, setGranularityOverride] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [page, setPage] = useState(0);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);
  const [csvMessage, setCsvMessage] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);
  const fileInputRef = useRef(null);

  // Restore the last-used range. The filters are written back whenever they
  // change, so the Overview opens exactly where the user left it.
  useEffect(() => {
    let active = true;

    getSetting(FILTERS_KEY, null)
      .then((saved) => {
        if (active) {
          setFilters(normalizeFilters(saved));
        }
      })
      .catch((settingsError) => {
        console.error("Failed to load overview filters:", settingsError);
        if (active) {
          setFilters(normalizeFilters(null));
          setError("Could not restore the saved filters.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!filters) {
      return;
    }

    setSetting(FILTERS_KEY, filters).catch((settingsError) => {
      console.error("Failed to save overview filters:", settingsError);
    });
  }, [filters]);

  const range = useMemo(
    () =>
      filters
        ? getPresetRange(filters.preset, { ...filters, now: today })
        : null,
    [filters, today],
  );

  const startISO = range ? toISODate(range.start) : "";
  const endISO = range ? toISODate(range.end) : "";

  // Day buckets are only useful for short ranges, so pick a sensible default
  // every time the range changes. The toggle below still overrides it, and
  // changing the range clears that override.
  const granularity =
    granularityOverride ??
    (range ? getAutoGranularity(range.start, range.end) : "day");

  useEffect(() => {
    if (!startISO || !endISO) {
      return undefined;
    }

    const start = parseISODate(startISO);
    const end = parseISODate(endISO);
    const previousRange = getPreviousRange({ start, end });
    let active = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    Promise.all([
      getExpensesByRange(startISO, endISO),
      getExpensesByRange(
        toISODate(previousRange.start),
        toISODate(previousRange.end),
      ),
      getCategories(),
    ])
      .then(([currentRows, previousRows, categoryRows]) => {
        if (!active) {
          return;
        }

        setExpenses(currentRows);
        setPreviousExpenses(previousRows);
        setCategories(categoryRows);
        setLoading(false);
      })
      .catch((loadError) => {
        console.error("Failed to load overview data:", loadError);

        if (active) {
          setError(loadError.message || "Could not load expenses.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [startISO, endISO, version]);

  const overview = useMemo(() => {
    if (!range) {
      return null;
    }

    return buildOverview(expenses, categories, {
      start: range.start,
      end: range.end,
      granularity,
    });
  }, [expenses, categories, range, granularity]);

  const previousTotal = useMemo(
    () => sumExpenses(previousExpenses),
    [previousExpenses],
  );

  const delta = overview ? overview.total - previousTotal : 0;
  const deltaPercent = previousTotal > 0 ? (delta / previousTotal) * 100 : null;

  const categoryColors = useMemo(() => {
    const map = new Map();

    for (const category of categories) {
      map.set(category.name.toLowerCase(), category.color);
    }

    return map;
  }, [categories]);

  const handlePresetChange = (preset) => {
    setGranularityOverride(null);
    setPage(0);
    setConfirmDeleteId(null);
    setFilters((current) => ({ ...current, preset }));
  };

  const handleCustomDateChange = (field, value) => {
    if (!value) {
      return;
    }

    setGranularityOverride(null);
    setPage(0);
    setConfirmDeleteId(null);
    setFilters((current) => ({
      ...current,
      preset: "custom",
      [field]: value,
    }));
  };

  const handleDelete = async (expense) => {
    // First click arms the destructive action; the second one deletes.
    if (confirmDeleteId !== expense.id) {
      setConfirmDeleteId(expense.id);
      return;
    }

    setDeletingId(expense.id);
    setError("");

    try {
      await deleteExpense(expense.id);
      setConfirmDeleteId(null);
    } catch (deleteError) {
      console.error("Failed to delete expense:", deleteError);
      setError(deleteError.message || "Could not delete the expense.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = async () => {
    if (expenses.length === 0) {
      return;
    }

    const filename = `expenses_${startISO}_to_${endISO}.csv`;
    downloadCsv(filename, toCsv(expenses));
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setCsvBusy(true);
    setCsvMessage("");

    try {
      const text = await file.text();
      const { rows, errors } = parseCsv(text);

      let imported = 0;
      const categories = await getCategories();
      const known = new Set(categories.map((item) => item.name.toLowerCase()));

      for (const row of rows) {
        if (!known.has(row.category.toLowerCase())) {
          await addCategory({ name: row.category, color: "#94a3b8" });
          known.add(row.category.toLowerCase());
        }

        await addExpense(row);
        imported += 1;
      }

      const skipped = errors.length;
      setCsvMessage(
        `Imported ${imported} expense${imported === 1 ? "" : "s"}` +
          (skipped > 0
            ? `, skipped ${skipped} row${skipped === 1 ? "" : "s"}.`
            : "."),
      );

      if (errors.length > 0) {
        console.warn("CSV import errors:", errors);
      }
    } catch (importError) {
      console.error("Failed to import CSV:", importError);
      setCsvMessage(importError.message || "Could not import the CSV.");
    } finally {
      setCsvBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAllInRange = async () => {
    setDeleteAllBusy(true);
    setError("");

    try {
      await deleteExpensesByRange(startISO, endISO);
      setShowDeleteAllDialog(false);
      setPage(0);
    } catch (deleteError) {
      console.error("Failed to delete range:", deleteError);
      setError(deleteError.message || "Could not delete the range.");
    } finally {
      setDeleteAllBusy(false);
    }
  };

  const isInitialLoading = !filters || (loading && expenses.length === 0);
  const pageCount = Math.max(1, Math.ceil(expenses.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const visibleExpenses = expenses.slice(pageStart, pageStart + PAGE_SIZE);

  const goToPage = (nextPage) => {
    setConfirmDeleteId(null);
    setPage(Math.max(0, Math.min(nextPage, pageCount - 1)));
  };

  return (
    <main className="flex min-h-full flex-col bg-[#0d0f12] text-white">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-8 sm:px-8">
        <header className="mb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Overview
          </p>
        </header>

        {/* Range filters */}
        <section className="mb-5">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {RANGE_PRESETS.map((preset) => {
              const active = filters?.preset === preset.id;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetChange(preset.id)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-white/20 bg-white text-zinc-900"
                      : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/[0.14] hover:text-zinc-200"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {filters?.preset === "custom" && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="date"
                aria-label="Start date"
                value={filters.customStart}
                max={filters.customEnd}
                onChange={(event) =>
                  handleCustomDateChange("customStart", event.target.value)
                }
                className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[#171a1f] px-3 py-2 text-xs text-zinc-200 outline-none transition focus:border-white/25"
              />

              <span className="text-xs text-zinc-600">to</span>

              <input
                type="date"
                aria-label="End date"
                value={filters.customEnd}
                min={filters.customStart}
                max={toISODate(today)}
                onChange={(event) =>
                  handleCustomDateChange("customEnd", event.target.value)
                }
                className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[#171a1f] px-3 py-2 text-xs text-zinc-200 outline-none transition focus:border-white/25"
              />
            </div>
          )}

          <p className="mt-3 text-[11px] text-zinc-600">
            {startISO && endISO
              ? `${formatDateLabel(startISO)} → ${formatDateLabel(endISO)}`
              : "Loading range…"}
          </p>
        </section>

        {error && (
          <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {isInitialLoading || !overview ? (
          <div className="space-y-4">
            <div className="h-32 animate-pulse rounded-2xl border border-white/[0.06] bg-[#111418]" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-20 animate-pulse rounded-xl border border-white/[0.06] bg-[#111418]"
                />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-2xl border border-white/[0.06] bg-[#111418]" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Headline total */}
            <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#171b21] to-[#111418] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Total spend
                  </p>
                  <p className="mt-1 break-words text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                    {formatMoney(overview.total)}
                  </p>
                  <div className="mt-2">
                    <DeltaBadge delta={delta} percent={deltaPercent} />
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Transactions
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {overview.count}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Average / day
                  </p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-zinc-200">
                    {formatMoney(overview.averagePerDay)}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Average / expense
                  </p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-zinc-200">
                    {formatMoney(overview.averagePerExpense)}
                  </p>
                </div>
              </div>
            </section>

            {/* Quick stats */}
            <section className="grid grid-cols-2 gap-3">
              <StatCard
                label="Top category"
                value={overview.topCategory?.name ?? "—"}
                hint={
                  overview.topCategory
                    ? formatMoney(overview.topCategory.total)
                    : "No expenses yet"
                }
              />

              <StatCard
                label="Largest expense"
                value={
                  overview.largestExpense
                    ? formatMoney(overview.largestExpense.amount)
                    : "—"
                }
                hint={
                  overview.largestExpense
                    ? `${overview.largestExpense.category} · ${formatDateLabel(
                        overview.largestExpense.date,
                      )}`
                    : undefined
                }
              />

              <StatCard
                label="Top spending day"
                value={
                  overview.topDay ? formatMoney(overview.topDay.total) : "—"
                }
                hint={
                  overview.topDay
                    ? formatDateLabel(overview.topDay.date)
                    : undefined
                }
              />

              <StatCard
                label="Active days"
                value={`${overview.activeDays} / ${overview.daysInRange}`}
                hint="Days with at least one expense"
              />
            </section>

            {/* Category breakdown */}
            <section className="rounded-2xl border border-white/[0.07] bg-[#111418] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Spend by category
                </h2>
                <span className="text-[11px] text-zinc-600">
                  {overview.byCategory.length}{" "}
                  {overview.byCategory.length === 1 ? "category" : "categories"}
                </span>
              </div>

              <CategoryBreakdownChart
                byCategory={overview.byCategory}
                total={overview.total}
              />
            </section>

            {/* Category over time */}
            <section className="rounded-2xl border border-white/[0.07] bg-[#111418] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Spend over time
                </h2>

                <div className="inline-flex shrink-0 rounded-lg border border-white/[0.08] p-0.5">
                  {["day", "month"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setGranularityOverride(option)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                        granularity === option
                          ? "bg-white/10 text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <CategoryTimeChart series={overview.series} />
            </section>

            {/* Recent transactions */}
            <section className="rounded-2xl border border-white/[0.07] bg-[#111418] p-4">
              <div className="mb-1 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Transactions
                </h2>
                <span className="text-[11px] text-zinc-600">
                  {overview.count} in range
                </span>
              </div>

              {csvMessage && (
                <p className="mb-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-zinc-300">
                  {csvMessage}
                </p>
              )}

              {visibleExpenses.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-600">
                  No transactions in this range.
                </p>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {visibleExpenses.map((expense) => (
                    <li
                      key={expense.id}
                      className="flex items-center gap-3 py-3"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            categoryColors.get(
                              expense.category.toLowerCase(),
                            ) ?? "#94a3b8",
                        }}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-zinc-200">
                          {expense.category}
                        </p>

                        <p className="mt-0.5 truncate text-[11px] text-zinc-600">
                          {formatDateLabel(expense.date)}
                          {expense.notes ? ` · ${expense.notes}` : ""}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <p className="shrink-0 text-sm font-medium tabular-nums text-zinc-100">
                          {formatMoney(expense.amount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleDelete(expense)}
                          disabled={deletingId === expense.id}
                          aria-label={`Delete ${expense.category} expense`}
                          className={`shrink-0 rounded-lg px-2 py-1 text-xs transition disabled:opacity-40 ${
                            confirmDeleteId === expense.id
                              ? "bg-red-500/15 text-red-300"
                              : "text-zinc-600 hover:bg-red-500/10 hover:text-red-300"
                          }`}
                        >
                          {deletingId === expense.id
                            ? "…"
                            : confirmDeleteId === expense.id
                              ? "Confirm?"
                              : "Delete"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {expenses.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-3">
                  <span className="text-[11px] text-zinc-600">
                    Showing {pageStart + 1}–
                    {Math.min(pageStart + PAGE_SIZE, expenses.length)} of{" "}
                    {expenses.length}
                  </span>

                  {pageCount > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => goToPage(safePage - 1)}
                        disabled={safePage === 0}
                        className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[11px] text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Previous
                      </button>

                      <span className="text-[11px] tabular-nums text-zinc-500">
                        Page {safePage + 1} / {pageCount}
                      </span>

                      <button
                        type="button"
                        onClick={() => goToPage(safePage + 1)}
                        disabled={safePage >= pageCount - 1}
                        className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[11px] text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={expenses.length === 0}
                    className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[11px] text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Export CSV
                  </button>

                  <label className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[11px] text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200 cursor-pointer">
                    {csvBusy ? "Importing…" : "Import CSV"}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={handleImportFile}
                      disabled={csvBusy}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowDeleteAllDialog(true)}
                    disabled={deleteAllBusy}
                    className="rounded-lg border border-red-500/20 px-2.5 py-1 text-[11px] text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {deleteAllBusy ? "Deleting…" : "Delete all in range"}
                  </button>
                </div>
            </section>
          </div>
        )}

        {showDeleteAllDialog && (
          <Modal
            title="Delete all in range"
            description={`This will permanently delete ${expenses.length} expense${
              expenses.length === 1 ? "" : "s"
            } in the selected range.`}
            onClose={() => {
              if (!deleteAllBusy) {
                setShowDeleteAllDialog(false);
              }
            }}
          >
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteAllDialog(false)}
                disabled={deleteAllBusy}
                className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200 disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteAllInRange}
                disabled={deleteAllBusy}
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
              >
                {deleteAllBusy ? "Deleting…" : "Delete all"}
              </button>
            </div>
          </Modal>
        )}

        <Footer />
      </div>
    </main>
  );
}
