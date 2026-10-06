import { useState } from "react";

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

export function FormField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>

      {children}
    </label>
  );
}

export function DateButton({ children, onClick, label }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200 active:scale-90"
    >
      {children}
    </button>
  );
}

export function DatePicker({ selectedDate, setSelectedDate }) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const changeDate = (days) => {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  const updateDatePart = (part, value) => {
    const next = new Date(selectedDate);

    if (part === "month") {
      next.setMonth(Number(value));
    }

    if (part === "day") {
      next.setDate(Number(value));
    }

    if (part === "year") {
      next.setFullYear(Number(value));
    }

    setSelectedDate(next);
  };

  const formattedDate = selectedDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    weekday: "long",
  });

  const month = selectedDate.getMonth();
  const day = selectedDate.getDate();
  const year = selectedDate.getFullYear();

  return (
    <>
      <div className="flex items-center justify-center gap-1">
        <DateButton label="Previous week" onClick={() => changeDate(-7)}>
          «
        </DateButton>

        <DateButton label="Previous day" onClick={() => changeDate(-1)}>
          ‹
        </DateButton>

        <button
          onClick={() => setDatePickerOpen((open) => !open)}
          className="mx-2 min-w-0 flex-1 rounded-xl px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.05] active:scale-[0.98] sm:text-base"
        >
          {formattedDate}
        </button>

        <DateButton label="Next day" onClick={() => changeDate(1)}>
          ›
        </DateButton>

        <DateButton label="Next week" onClick={() => changeDate(7)}>
          »
        </DateButton>
      </div>

      {/* --------------------------------
        Expandable date editor
    -------------------------------- */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          datePickerOpen
            ? "mt-4 grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mx-auto flex max-w-sm gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
            <select
              value={month}
              onChange={(e) => updateDatePart("month", e.target.value)}
              className="min-w-0 flex-1 appearance-none rounded-xl border border-white/[0.07] bg-[#171a1f] px-3 py-2.5 text-sm text-zinc-200 outline-none transition focus:border-white/20"
            >
              {months.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              max="31"
              value={day}
              onChange={(e) => updateDatePart("day", e.target.value)}
              className="w-16 rounded-xl border border-white/[0.07] bg-[#171a1f] px-2 py-2.5 text-center text-sm text-zinc-200 outline-none transition focus:border-white/20"
            />

            <input
              type="number"
              min="2000"
              max="2200"
              value={year}
              onChange={(e) => updateDatePart("year", e.target.value)}
              className="w-20 rounded-xl border border-white/[0.07] bg-[#171a1f] px-2 py-2.5 text-center text-sm text-zinc-200 outline-none transition focus:border-white/20"
            />
          </div>
        </div>
      </div>
    </>
  );
}

export function Footer() {
  return (
    <footer className="pt-6 text-center text-xs text-zinc-700">
      Expense Tracker • A Canary Project • by Jason Lorenzo
    </footer>
  );
}
