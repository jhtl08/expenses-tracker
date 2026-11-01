import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CATEGORY_COLORS } from "../database/defaults.js";

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
      Expense Tracker • A Canary Project
    </footer>
  );
}

export function Modal({ title, description, onClose, children, footer, centered = false }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex justify-center bg-black/70 backdrop-blur-sm ${
        centered ? "items-center p-4 sm:p-6" : "items-end sm:items-center sm:p-6"
      }`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden border border-white/10 bg-[#111418] shadow-2xl ${
          centered ? "rounded-2xl" : "rounded-t-3xl sm:rounded-2xl"
        }`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">{title}</h2>

            {description && (
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {footer && (
          <div className="border-t border-white/[0.07] px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORY_COLORS.map((color) => {
        const selected = color.toLowerCase() === value?.toLowerCase();

        return (
          <button
            key={color}
            type="button"
            aria-label={`Use colour ${color}`}
            aria-pressed={selected}
            onClick={() => onChange(color)}
            className={`h-7 w-7 rounded-full border-2 transition ${
              selected
                ? "scale-110 border-white"
                : "border-transparent hover:scale-105"
            }`}
            style={{ backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}
