import { useEffect, useState } from "react";
import { Modal } from "./Components.jsx";
import {
  addScheduledExpense,
  deleteScheduledExpense,
  getScheduledExpenses,
  updateScheduledExpense,
} from "../database/scheduled.js";
import { useCategories, useDataVersion } from "../hooks/useDatabase.js";
import { toISODate } from "../utils/date.js";
import { formatMoney } from "../utils/format.js";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const RECURRENCE_OPTIONS = [
  { id: "monthly", label: "Monthly (day of month)" },
  { id: "yearly", label: "Yearly (day + month)" },
  { id: "interval", label: "Every N days" },
];

export function ScheduledManager() {
  const { categories } = useCategories();
  const version = useDataVersion();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [monthOfYear, setMonthOfYear] = useState("0");
  const [intervalDays, setIntervalDays] = useState("7");
  const [startDate, setStartDate] = useState(toISODate(new Date()));

  const [editingId, setEditingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  // Clicking anywhere other than the armed button disarms "Confirm?".
  useEffect(() => {
    if (pendingDeleteId === null) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (
        !event.target.closest(`[data-confirm-id="${pendingDeleteId}"]`)
      ) {
        setPendingDeleteId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [pendingDeleteId]);

  const effectiveCategory =
    categories.find((item) => item.name === category)?.name ??
    categories[0]?.name ??
    "";

  useEffect(() => {
    let active = true;

    getScheduledExpenses()
      .then((rows) => {
        if (active) {
          setItems(rows);
          setLoading(false);
        }
      })
      .catch((loadError) => {
        console.error("Failed to load scheduled expenses:", loadError);
        if (active) {
          setLoading(false);
          setError("Could not load scheduled expenses.");
        }
      });

    return () => {
      active = false;
    };
  }, [version]);

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setAmount("");
    setNotes("");
    setRecurrenceType("monthly");
    setDayOfMonth("1");
    setMonthOfYear("0");
    setIntervalDays("7");
    setStartDate(toISODate(new Date()));
    setEditingId(null);
    setPendingDeleteId(null);
    setShowForm(false);
  };

  const startEditing = (item) => {
    setShowForm(true);
    setEditingId(item.id);
    setTitle(item.title);
    setCategory(item.category);
    setAmount(String(item.amount));
    setNotes(item.notes ?? "");
    setRecurrenceType(item.recurrenceType);
    setDayOfMonth(String(item.dayOfMonth ?? 1));
    setMonthOfYear(String(item.monthOfYear ?? 0));
    setIntervalDays(String(item.intervalDays ?? 7));
    setStartDate(item.startDate ?? toISODate(new Date()));
    setPendingDeleteId(null);
    setError("");
  };

  const buildPayload = () => ({
    title,
    category: effectiveCategory,
    amount: Number(amount),
    notes,
    recurrenceType,
    dayOfMonth:
      recurrenceType === "interval" ? null : Number(dayOfMonth),
    monthOfYear:
      recurrenceType === "yearly" ? Number(monthOfYear) : null,
    intervalDays:
      recurrenceType === "interval" ? Number(intervalDays) : null,
    // Anchors every recurrence type. Defaults to today on creation, so a new
    // schedule never backfills past dates.
    startDate: startDate || null,
  });

  const handleSave = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      if (!title.trim()) {
        throw new Error("Enter a title.");
      }

      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        throw new Error("Enter a valid amount.");
      }

      if (editingId !== null) {
        await updateScheduledExpense(editingId, buildPayload());
      } else {
        await addScheduledExpense(buildPayload());
      }

      resetForm();
    } catch (saveError) {
      setError(saveError.message || "Could not save the scheduled expense.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item) => {
    if (pendingDeleteId !== item.id) {
      setPendingDeleteId(item.id);
      return;
    }

    setBusy(true);
    setError("");

    try {
      await deleteScheduledExpense(item.id);
      setPendingDeleteId(null);

      if (editingId === item.id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete the scheduled expense.");
    } finally {
      setBusy(false);
    }
  };

  const describe = (item) => {
    if (item.recurrenceType === "monthly") {
      return `Monthly on day ${item.dayOfMonth}`;
    }

    if (item.recurrenceType === "yearly") {
      return `Yearly on ${months[item.monthOfYear ?? 0]} ${item.dayOfMonth}`;
    }

    return `Every ${item.intervalDays} day${item.intervalDays === 1 ? "" : "s"}`;
  };

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[#111418] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-200">
          Scheduled expenses
        </h3>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[11px] text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200"
        >
          Add scheduled expense
        </button>
      </div>

      {error && !showForm && (
        <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {showForm && (
        <Modal
          centered
          title={
            editingId !== null ? "Edit scheduled expense" : "New scheduled expense"
          }
          onClose={resetForm}
        >
          {error && (
            <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Title
              </span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#171a1f] px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-white/25"
                placeholder="e.g. Rent"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Category
              </span>
              <select
                value={effectiveCategory}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#171a1f] px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-white/25"
              >
                {categories.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Amount
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#171a1f] px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-white/25"
                placeholder="0.00"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Recurrence
              </span>
              <select
                value={recurrenceType}
                onChange={(event) => setRecurrenceType(event.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#171a1f] px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-white/25"
              >
                {RECURRENCE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {recurrenceType === "monthly" && (
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Day of month
              </span>
              <input
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(event) => setDayOfMonth(event.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#171a1f] px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-white/25"
              />
            </label>
          )}

          {recurrenceType === "yearly" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Month
                </span>
                <select
                  value={monthOfYear}
                  onChange={(event) => setMonthOfYear(event.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#171a1f] px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-white/25"
                >
                  {months.map((name, index) => (
                    <option key={name} value={index}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Day
                </span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(event) => setDayOfMonth(event.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#171a1f] px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-white/25"
                />
              </label>
            </div>
          )}

          {recurrenceType === "interval" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Every (days)
                </span>
                <input
                  type="number"
                  min="1"
                  value={intervalDays}
                  onChange={(event) => setIntervalDays(event.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#171a1f] px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-white/25"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Start date
                </span>
                <input
                  type="date"
                  value={startDate}
                  min={toISODate(new Date())}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#171a1f] px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-white/25"
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Notes (optional)
            </span>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-[#171a1f] px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-white/25"
            />
          </label>

          <div className="flex gap-2">
            {editingId !== null && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                }}
                className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
            >
              {editingId !== null ? "Save changes" : "Add scheduled expense"}
            </button>
          </div>
          </form>
        </Modal>
      )}

      {loading && items.length === 0 && (
        <p className="py-4 text-center text-xs text-zinc-600">Loading…</p>
      )}

      {!loading && items.length === 0 && (
        <p className="py-4 text-center text-xs text-zinc-600">
          No scheduled expenses yet.
        </p>
      )}

      <ul className="divide-y divide-white/[0.05]">
        {items.map((item) => {
          const confirming = pendingDeleteId === item.id;

          return (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-zinc-200">
                  {item.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-zinc-600">
                  {item.category} · {describe(item)}
                </p>
              </div>

              <div className="shrink-0 text-right font-medium tabular-nums text-zinc-200">
                {formatMoney(item.amount)}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => startEditing(item)}
                  className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200"
                >
                  Edit
                </button>

                <button
                  type="button"
                  data-confirm-id={item.id}
                  onClick={() => handleDelete(item)}
                  disabled={busy}
                  className={`rounded-lg px-2 py-1 text-xs transition disabled:opacity-40 ${
                    confirming
                      ? "bg-red-500/15 text-red-300"
                      : "text-zinc-600 hover:bg-red-500/10 hover:text-red-300"
                  }`}
                >
                  {confirming ? "Confirm?" : "Delete"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
