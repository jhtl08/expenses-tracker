import { useEffect, useState } from "react";
import { FormField, DatePicker, Footer } from "../components/Components.jsx";
import { CategoryManager } from "./CategoryManager.jsx";
import {
  addExpense,
  deleteExpense,
  getExpenses,
  updateExpense,
} from "../database/expenses.js";
import { useCategories, useDataVersion } from "../hooks/useDatabase.js";
import { formatDateLabel, parseISODate, toISODate } from "../utils/date.js";
import { formatMoney } from "../utils/format.js";

const RECENT_LIMIT = 5;

export function Entry({
  selectedDate,
  setSelectedDate,
  autoRegistered = [],
  setAutoRegistered = () => {},
}) {
  const { categories, loading: loadingCategories } = useCategories();
  const version = useDataVersion();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const [message, setMessage] = useState("");

  // Expense being edited. null means the form adds a new expense.
  const [editingId, setEditingId] = useState(null);

  // Expense waiting for a second click on Delete.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Second-click arming for the auto-registered notice (expense id or "all").
  const [autoConfirm, setAutoConfirm] = useState(null);

  const [recentExpenses, setRecentExpenses] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);

  const effectiveCategory = categories.some((item) => item.name === category)
    ? category
    : (categories[0]?.name ?? "");

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  // Latest five transactions, across every date. Reloads after any write so
  // deleting a row immediately pulls the next latest expense into the list.
  useEffect(() => {
    let active = true;

    getExpenses({ limit: RECENT_LIMIT })
      .then((rows) => {
        if (active) {
          setRecentExpenses(rows);
          setRecentLoading(false);
        }
      })
      .catch((error) => {
        console.error("Failed to load recent transactions:", error);
        if (active) {
          setRecentLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [version]);

  // Clicking anywhere other than the armed button disarms "Confirm?".
  useEffect(() => {
    if (confirmDeleteId === null) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!event.target.closest(`[data-confirm-id="${confirmDeleteId}"]`)) {
        setConfirmDeleteId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [confirmDeleteId]);

  // Same disarm-on-outside-click for the auto-registered notice.
  useEffect(() => {
    if (autoConfirm === null) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!event.target.closest(`[data-auto-confirm="${autoConfirm}"]`)) {
        setAutoConfirm(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [autoConfirm]);

  const showMessage = (text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2500);
  };

  const clearForm = () => {
    setAmount("");
    setNotes("");
    setEditingId(null);
    setConfirmDeleteId(null);
  };

  // -----------------------------
  // Form
  // -----------------------------

  const handleSubmitExpense = async () => {
    if (!amount || Number(amount) <= 0) {
      setMessage("Enter a valid amount.");
      return;
    }

    if (!effectiveCategory) {
      setMessage("Add a category first.");
      return;
    }

    const payload = {
      date: toISODate(selectedDate),
      category: effectiveCategory,
      amount: Number(amount),
      notes,
    };

    try {
      if (editingId !== null) {
        await updateExpense(editingId, payload);
        showMessage("Expense updated");
      } else {
        await addExpense(payload);
        showMessage("Expense added");
      }

      clearForm();
    } catch (error) {
      console.error("Failed to save expense:", error);
      setMessage(error.message || "Failed to save expense.");
    }
  };

  const startEditing = (expense) => {
    setEditingId(expense.id);
    setCategory(expense.category);
    setAmount(String(expense.amount));
    setNotes(expense.notes ?? "");

    const expenseDate = parseISODate(expense.date);
    if (expenseDate) {
      setSelectedDate(expenseDate);
    }

    setConfirmDeleteId(null);
    setMessage("");
  };

  const cancelEditing = () => {
    clearForm();
    showMessage("Edit cancelled.");
  };

  // -----------------------------
  // Recent transactions
  // -----------------------------

  const handleDelete = async (expense) => {
    if (confirmDeleteId !== expense.id) {
      setConfirmDeleteId(expense.id);
      return;
    }

    try {
      await deleteExpense(expense.id);

      if (editingId === expense.id) {
        clearForm();
      }

      setConfirmDeleteId(null);
      showMessage("Expense deleted");
    } catch (error) {
      console.error("Failed to delete expense:", error);
      setMessage(error.message || "Failed to delete expense.");
    }
  };

  // -----------------------------
  // Auto-registered scheduled expenses
  // -----------------------------

  const dismissAutoRegistered = () => {
    setAutoConfirm(null);
    setAutoRegistered([]);
  };

  const handleDeleteAuto = async (expense) => {
    if (autoConfirm !== expense.id) {
      setAutoConfirm(expense.id);
      return;
    }

    try {
      await deleteExpense(expense.id);
      setAutoRegistered((current) =>
        current.filter((item) => item.id !== expense.id),
      );
      setAutoConfirm(null);
      showMessage("Expense deleted");
    } catch (error) {
      console.error("Failed to delete expense:", error);
      setMessage(error.message || "Failed to delete expense.");
    }
  };

  const handleDeleteAllAuto = async () => {
    if (autoConfirm !== "all") {
      setAutoConfirm("all");
      return;
    }

    try {
      for (const expense of autoRegistered) {
        await deleteExpense(expense.id);
      }

      dismissAutoRegistered();
      showMessage("Auto-registered expenses deleted");
    } catch (error) {
      console.error("Failed to delete expenses:", error);
      setMessage(error.message || "Failed to delete expenses.");
    }
  };

  const categoryColor = (name) =>
    categories.find((item) => item.name.toLowerCase() === name.toLowerCase())
      ?.color ?? "#94a3b8";

  return (
    <main className="flex min-h-full flex-col bg-[#0d0f12] text-white">
      {/* --------------------------------
          Main content
      -------------------------------- */}
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-8 sm:px-8">
        {/* --------------------------------
            Header
        -------------------------------- */}
        <header className="mb-8 text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Expense Entry
          </p>
          <DatePicker
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        </header>

        {/* --------------------------------
            Expense form
        -------------------------------- */}
        <section className="flex flex-1 flex-col">
          {editingId !== null && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <span className="min-w-0 truncate">
                Editing an existing expense
              </span>

              <button
                type="button"
                onClick={cancelEditing}
                className="shrink-0 rounded-lg px-2 py-1 font-medium text-amber-100/80 transition hover:bg-amber-500/15 hover:text-amber-100"
              >
                Cancel edit
              </button>
            </div>
          )}

          <div className="space-y-5">
            {/* Category */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Category
                </span>

                <button
                  type="button"
                  onClick={() => setShowCategoryManager(true)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200"
                >
                  Manage
                </button>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen((prev) => !prev)}
                  disabled={loadingCategories && categories.length === 0}
                  className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-[#171a1f] px-4 py-3 text-sm text-zinc-200 outline-none transition hover:border-white/[0.12] focus:border-white/25 disabled:opacity-60"
                >
                  <span>{effectiveCategory || "Select category"}</span>
                  <svg
                    className={`h-4 w-4 text-zinc-500 transition-transform ${
                      categoryDropdownOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m6 9 6 6 6-6"
                    />
                  </svg>
                </button>

                {categoryDropdownOpen && (
                  <div className="absolute z-50 mt-2 max-h-52 w-full overflow-y-auto rounded-xl border border-white/[0.08] bg-[#171a1f] p-1 shadow-xl">
                    {categories.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setCategory(item.name);
                          setCategoryDropdownOpen(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                          effectiveCategory === item.name
                            ? "bg-white/[0.08] text-white"
                            : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Amount */}
            <FormField label="Amount">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                  ₱
                </span>

                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1.00"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#171a1f] py-3 pl-9 pr-4 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 hover:border-white/[0.12] focus:border-white/25"
                />
              </div>
            </FormField>

            {/* Notes */}
            <FormField label="Notes">
              <div className="relative">
                <textarea
                  value={notes}
                  maxLength={150}
                  rows={4}
                  placeholder="Add a note..."
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#171a1f] px-4 py-3 pb-8 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 hover:border-white/[0.12] focus:border-white/25"
                />

                <span className="absolute bottom-2.5 right-3 text-[11px] text-zinc-600">
                  {notes.length}/150
                </span>
              </div>
            </FormField>
          </div>

          {/* --------------------------------
              Actions
          -------------------------------- */}
          <div className="pt-6">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  clearForm();
                  showMessage("Form cleared.");
                }}
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200 active:scale-[0.98]"
              >
                Clear Form
              </button>

              <button
                type="button"
                onClick={handleSubmitExpense}
                className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 active:scale-[0.98]"
              >
                {editingId !== null ? "Update Expense" : "Add Expense"}
              </button>
            </div>

            {/* Feedback */}
            <div className="h-8 pt-3 text-center text-xs text-zinc-500">
              {message}
            </div>
          </div>
        </section>

        {/* --------------------------------
            Auto-registered scheduled expenses
        -------------------------------- */}
        {autoRegistered.length > 0 && (
          <section className="mt-6 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="text-xs font-medium leading-relaxed text-violet-200">
                The following scheduled expenses were automatically registered:
              </p>

              <button
                type="button"
                onClick={dismissAutoRegistered}
                aria-label="Dismiss"
                className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-violet-300/70 transition hover:bg-violet-500/15 hover:text-violet-100"
              >
                ×
              </button>
            </div>

            <ul className="divide-y divide-violet-500/15">
              {autoRegistered.map((expense) => (
                <li key={expense.id} className="flex items-center gap-3 py-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: categoryColor(expense.category),
                    }}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-violet-100">
                      {expense.category}
                    </p>

                    <p className="mt-0.5 truncate text-[11px] text-violet-300/70">
                      {formatDateLabel(expense.date)}
                      {expense.notes ? ` · ${expense.notes}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <p className="text-sm font-medium tabular-nums text-violet-100">
                      {formatMoney(expense.amount)}
                    </p>

                    <button
                      type="button"
                      data-auto-confirm={expense.id}
                      onClick={() => handleDeleteAuto(expense)}
                      aria-label={`Delete ${expense.category} expense`}
                      className={`rounded-lg px-2 py-1 text-xs transition ${
                        autoConfirm === expense.id
                          ? "bg-red-500/15 text-red-300"
                          : "text-violet-300/70 hover:bg-red-500/10 hover:text-red-300"
                      }`}
                    >
                      {autoConfirm === expense.id ? "Confirm?" : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                data-auto-confirm="all"
                onClick={handleDeleteAllAuto}
                className={`rounded-lg border px-2.5 py-1 text-[11px] transition ${
                  autoConfirm === "all"
                    ? "border-red-500/30 bg-red-500/15 text-red-300"
                    : "border-red-500/20 text-red-300 hover:bg-red-500/10"
                }`}
              >
                {autoConfirm === "all" ? "Confirm delete all?" : "Delete all"}
              </button>
            </div>
          </section>
        )}

        {/* --------------------------------
            Latest transactions
        -------------------------------- */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-200">
              Recent transactions
            </h2>
            <span className="text-[11px] text-zinc-600">
              {recentExpenses.length} latest
            </span>
          </div>

          {recentLoading && recentExpenses.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-14 animate-pulse rounded-xl border border-white/[0.06] bg-[#111418]"
                />
              ))}
            </div>
          ) : recentExpenses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.07] py-6 text-center text-xs text-zinc-600">
              No expenses yet.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/[0.06] bg-[#111418]">
              {recentExpenses.map((expense) => {
                const isEditing = editingId === expense.id;
                const isConfirming = confirmDeleteId === expense.id;

                return (
                  <li
                    key={expense.id}
                    className={`flex items-center gap-3 px-3 py-2.5 ${
                      isEditing ? "bg-white/[0.04]" : ""
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: categoryColor(expense.category),
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

                    <div className="flex shrink-0 items-center gap-1">
                      <p className="text-sm font-medium tabular-nums text-zinc-100">
                        {formatMoney(expense.amount)}
                      </p>
                      <button
                        type="button"
                        onClick={() => startEditing(expense)}
                        aria-label={`Edit ${expense.category} expense`}
                        className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        data-confirm-id={expense.id}
                        onClick={() => handleDelete(expense)}
                        aria-label={`Delete ${expense.category} expense`}
                        className={`rounded-lg px-2 py-1 text-xs transition ${
                          isConfirming
                            ? "bg-red-500/15 text-red-300"
                            : "text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
                        }`}
                      >
                        {isConfirming ? "Confirm?" : "Delete"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Footer />
      </div>

      {showCategoryManager && (
        <CategoryManager
          open={showCategoryManager}
          onClose={() => setShowCategoryManager(false)}
        />
      )}
    </main>
  );
}
