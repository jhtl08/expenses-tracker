import { useState } from "react";
import { FormField, DatePicker, Footer } from "../components/Components.jsx";
import { addExpense } from "../database/expenses.js";

const categories = [
  "Groceries",
  "Food",
  "Transportation",
  "Rent",
  "Utilities",
  "Other",
];

export function Entry({ selectedDate, setSelectedDate }) {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [message, setMessage] = useState("");

  // -----------------------------
  // Form
  // -----------------------------

  const handleAddExpense = async () => {
    if (!amount || Number(amount) <= 0) {
      setMessage("Enter a valid amount.");
      return;
    }

    try {
      await addExpense({
        date: selectedDate.toISOString().split("T")[0],
        category,
        amount: Number(amount),
        notes,
      });

      setMessage("Expense added");

      setAmount("");
      setNotes("");

      setTimeout(() => {
        setMessage("");
      }, 2500);
    } catch (error) {
      console.error("Failed to add expense:", error);
      setMessage("Failed to add expense.");
    }
  };

  const clearForm = () => {
    setAmount("");
    setNotes("");
    setMessage("Form cleared.");
    setTimeout(() => {
      setMessage("");
    }, 2500);
  };

  return (
    <main className="min-h-screen bg-[#0d0f12] text-white">
      {/* --------------------------------
          Main content
      -------------------------------- */}
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-8 sm:px-8">
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
          <div className="space-y-5">
            {/* Category */}
            <FormField label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full appearance-none rounded-xl border border-white/[0.08] bg-[#171a1f] px-4 py-3 text-sm text-zinc-200 outline-none transition hover:border-white/[0.12] focus:border-white/25"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FormField>

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
          <div className="mt-auto pt-10">
            <div className="flex gap-3">
              <button
                onClick={() => clearForm()}
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200 active:scale-[0.98]"
              >
                Clear Form
              </button>

              <button
                onClick={handleAddExpense}
                className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 active:scale-[0.98]"
              >
                Add Expense
              </button>
            </div>

            {/* Feedback */}
            <div className="h-8 pt-3 text-center text-xs text-zinc-500">
              {message}
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
