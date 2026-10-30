// Dates are handled as local calendar dates everywhere in the app. Expenses
// store them as YYYY-MM-DD strings, which sort correctly and avoid timezone
// shifts when the app is opened in a different timezone.

export const RANGE_PRESETS = [
  { id: "this-month", label: "This Month" },
  { id: "last-month", label: "Last Month" },
  { id: "last-3-months", label: "Last 3 Months" },
  { id: "last-12-months", label: "Last 12 Months" },
  { id: "last-3-years", label: "Last 3 Years" },
  { id: "custom", label: "Custom" },
];

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function shiftMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseISODate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }

  return date;
}

export function daysBetween(start, end) {
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  return Math.round((endUtc - startUtc) / 86_400_000);
}

export function eachDay(start, end) {
  const days = [];
  const last = toISODate(startOfDay(end));
  let cursor = startOfDay(start);

  while (toISODate(cursor) <= last) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return days;
}

export function eachMonth(start, end) {
  const months = [];
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  let cursor = startOfMonth(start);

  while (cursor <= last) {
    months.push(cursor);
    cursor = shiftMonths(cursor, 1);
  }

  return months;
}

export function formatDayLabel(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatMonthKeyLabel(key) {
  const [year, month] = key.split("-");

  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "en-US",
    { month: "short", year: "numeric" },
  );
}

export function formatDateLabel(value) {
  const date = parseISODate(value);

  if (!date) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Resolve a preset into an inclusive local date range.
 * `customStart` / `customEnd` are YYYY-MM-DD strings.
 */
export function getPresetRange(preset, { now = new Date(), customStart, customEnd } = {}) {
  const today = startOfDay(now);

  switch (preset) {
    case "last-month": {
      const first = shiftMonths(today, -1);
      return { start: first, end: endOfMonth(first) };
    }
    case "last-3-months":
      return { start: shiftMonths(today, -2), end: today };
    case "last-12-months":
      return { start: shiftMonths(today, -11), end: today };
    case "last-3-years":
      return { start: new Date(today.getFullYear() - 2, 0, 1), end: today };
    case "custom": {
      const start = parseISODate(customStart) ?? startOfMonth(today);
      const end = parseISODate(customEnd) ?? today;

      return start <= end ? { start, end } : { start: end, end: start };
    }
    case "this-month":
    default:
      return { start: startOfMonth(today), end: today };
  }
}

export function getPreviousRange({ start, end }) {
  const days = daysBetween(start, end) + 1;

  return {
    start: addDays(start, -days),
    end: addDays(start, -1),
  };
}

/**
 * Day buckets become unreadable past a couple of months, so the chart defaults
 * to months for long ranges. The user can still toggle back to days.
 */
export function getAutoGranularity(start, end) {
  return daysBetween(start, end) + 1 > 62 ? "month" : "day";
}
