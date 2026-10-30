import {
  eachDay,
  eachMonth,
  formatDayLabel,
  formatMonthKeyLabel,
  toISODate,
} from "./date.js";
import { FALLBACK_CATEGORY_COLOR } from "../database/defaults.js";

function createCategoryLookup(categories) {
  const lookup = new Map();

  for (const category of categories) {
    lookup.set(category.name.trim().toLowerCase(), category);
  }

  return lookup;
}

function sumAmounts(expenses) {
  return expenses.reduce((total, expense) => total + Number(expense.amount), 0);
}

function buildBuckets(start, end, granularity) {
  if (granularity === "month") {
    return eachMonth(start, end).map((date) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      return { key, label: formatMonthKeyLabel(key) };
    });
  }

  return eachDay(start, end).map((date) => {
    const key = toISODate(date);
    return { key, label: formatDayLabel(date) };
  });
}

export function sumExpenses(expenses) {
  return sumAmounts(expenses);
}

/**
 * Turn the expenses of a range into everything the Overview page needs:
 * headline totals, per-category totals and a category-over-time matrix.
 */
export function buildOverview(
  expenses,
  categories,
  { start, end, granularity = "day" },
) {
  const categoryLookup = createCategoryLookup(categories);
  const grouped = new Map();
  const activeDays = new Set();
  let largestExpense = null;

  for (const expense of expenses) {
    const amount = Number(expense.amount);
    const rawName = String(expense.category ?? "Other").trim() || "Other";
    const key = rawName.toLowerCase();
    const known = categoryLookup.get(key);

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        name: known?.name ?? rawName,
        color: known?.color ?? FALLBACK_CATEGORY_COLOR,
        total: 0,
        count: 0,
      });
    }

    const entry = grouped.get(key);
    entry.total += amount;
    entry.count += 1;

    activeDays.add(expense.date);

    if (!largestExpense || amount > Number(largestExpense.amount)) {
      largestExpense = expense;
    }
  }

  const total = sumAmounts(expenses);
  const byCategory = [...grouped.values()]
    .sort((a, b) => b.total - a.total)
    .map((entry) => ({
      ...entry,
      share: total > 0 ? (entry.total / total) * 100 : 0,
    }));

  const daysInRange = eachDay(start, end).length;
  const buckets = buildBuckets(start, end, granularity);
  const bucketIndex = new Map(
    buckets.map((bucket, index) => [bucket.key, index]),
  );

  const seriesValues = byCategory.map(() =>
    new Array(buckets.length).fill(0),
  );
  const categoryIndex = new Map(
    byCategory.map((category, index) => [category.key, index]),
  );

  const dailyTotals = new Map();

  for (const expense of expenses) {
    const key =
      granularity === "month"
        ? String(expense.date).slice(0, 7)
        : String(expense.date);
    const index = bucketIndex.get(key);
    const categoryPosition = categoryIndex.get(
      String(expense.category ?? "Other").trim().toLowerCase(),
    );

    if (index !== undefined && categoryPosition !== undefined) {
      seriesValues[categoryPosition][index] += Number(expense.amount);
    }

    dailyTotals.set(
      expense.date,
      (dailyTotals.get(expense.date) ?? 0) + Number(expense.amount),
    );
  }

  let topDay = null;

  for (const [date, dayTotal] of dailyTotals.entries()) {
    if (!topDay || dayTotal > topDay.total) {
      topDay = { date, total: dayTotal };
    }
  }

  return {
    total,
    count: expenses.length,
    averagePerExpense: expenses.length > 0 ? total / expenses.length : 0,
    averagePerDay: daysInRange > 0 ? total / daysInRange : 0,
    activeDays: activeDays.size,
    daysInRange,
    byCategory,
    topCategory: byCategory[0] ?? null,
    largestExpense,
    topDay,
    series: {
      labels: buckets.map((bucket) => bucket.label),
      categories: byCategory.map(({ key, name, color, total: categoryTotal }) => ({
        key,
        name,
        color,
        total: categoryTotal,
      })),
      values: seriesValues,
    },
  };
}
