// Default configuration seeded into a fresh database.
// These values are only written once; afterwards the user owns them.

export const PROTECTED_CATEGORY = "Other";

export const DEFAULT_CATEGORIES = [
  { name: "Groceries", color: "#34d399" },
  { name: "Food", color: "#fbbf24" },
  { name: "Transportation", color: "#60a5fa" },
  { name: "Rent", color: "#a78bfa" },
  { name: "Utilities", color: "#f472b6" },
  { name: "Shopping", color: "#fb923c" },
  { name: "Health", color: "#2dd4bf" },
  { name: "Entertainment", color: "#f87171" },
  { name: PROTECTED_CATEGORY, color: "#94a3b8" },
];

export const FALLBACK_CATEGORY_COLOR = "#94a3b8";

export const CATEGORY_COLORS = [
  "#34d399",
  "#fbbf24",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#fb923c",
  "#2dd4bf",
  "#f87171",
  "#94a3b8",
  "#e879f9",
  "#facc15",
  "#4ade80",
];

export const DEFAULT_SHORTCUTS = [
  {
    id: 1,
    title: "Lunch",
    amount: 250,
    category: "Food",
    notes: "Usual lunch expense",
  },
  {
    id: 2,
    title: "Jeepney",
    amount: 20,
    category: "Transportation",
    notes: "",
  },
  {
    id: 3,
    title: "Coffee",
    amount: 180,
    category: "Food",
    notes: "Afternoon coffee",
  },
];
