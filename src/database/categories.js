import { initializeDatabase } from "./database.js";
import { notifyDataChanged } from "./events.js";
import { getShortcuts, saveShortcuts } from "./shortcuts.js";
import { FALLBACK_CATEGORY_COLOR, PROTECTED_CATEGORY } from "./defaults.js";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function normalizeCategory(row) {
  return {
    id: Number(row.id),
    name: row.name,
    color: row.color || FALLBACK_CATEGORY_COLOR,
    sortOrder: Number(row.sort_order),
  };
}

function normalizeName(name) {
  const trimmed = String(name ?? "").trim();

  if (!trimmed) {
    throw new Error("Enter a category name.");
  }

  if (trimmed.length > 32) {
    throw new Error("Category names must be 32 characters or fewer.");
  }

  return trimmed;
}

function normalizeColor(color) {
  return HEX_COLOR.test(color ?? "") ? color : FALLBACK_CATEGORY_COLOR;
}

function friendlyError(error, fallbackMessage) {
  if (String(error?.message ?? "").includes("UNIQUE constraint failed")) {
    return new Error("A category with that name already exists.");
  }

  return new Error(error?.message || fallbackMessage);
}

// Shortcuts store a category name too, so renames/deletes have to follow
// through there as well or tapping a shortcut would create orphaned expenses.
async function reassignShortcutCategory(fromName, toName) {
  const from = fromName.toLowerCase();
  const shortcuts = await getShortcuts();

  if (!shortcuts.some((shortcut) => shortcut.category.toLowerCase() === from)) {
    return;
  }

  await saveShortcuts(
    shortcuts.map((shortcut) =>
      shortcut.category.toLowerCase() === from
        ? { ...shortcut, category: toName }
        : shortcut,
    ),
  );
}

export async function getCategories() {
  const db = await initializeDatabase();
  const result = await db.query(
    "SELECT * FROM categories ORDER BY sort_order ASC, name ASC;",
  );

  return (result.values ?? []).map(normalizeCategory);
}

export async function getCategoryById(id) {
  const db = await initializeDatabase();
  const result = await db.query("SELECT * FROM categories WHERE id = ?;", [id]);

  return result.values?.[0] ? normalizeCategory(result.values[0]) : null;
}

export async function addCategory({ name, color }) {
  const db = await initializeDatabase();
  const normalizedName = normalizeName(name);
  const normalizedColor = normalizeColor(color);
  const orderResult = await db.query(
    "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM categories;",
  );
  const nextOrder = Number(orderResult.values?.[0]?.max_order ?? 0) + 1;

  try {
    const result = await db.run(
      `INSERT INTO categories (name, color, sort_order, created_at)
       VALUES (?, ?, ?, ?);`,
      [normalizedName, normalizedColor, nextOrder, new Date().toISOString()],
    );

    notifyDataChanged();

    return {
      id: Number(result.changes?.lastId),
      name: normalizedName,
      color: normalizedColor,
      sortOrder: nextOrder,
    };
  } catch (error) {
    throw friendlyError(error, "Could not add the category.");
  }
}

export async function updateCategory(id, { name, color }) {
  const db = await initializeDatabase();
  const existing = await getCategoryById(id);

  if (!existing) {
    throw new Error("That category no longer exists.");
  }

  const nextName = name === undefined ? existing.name : normalizeName(name);
  const nextColor =
    color === undefined ? existing.color : normalizeColor(color);

  const existingIsProtected =
    existing.name.toLowerCase() === PROTECTED_CATEGORY.toLowerCase();

  // "Other" has to keep its name, otherwise the delete fallback can be broken.
  if (existingIsProtected && nextName !== existing.name) {
    throw new Error(
      `"${PROTECTED_CATEGORY}" is reserved and cannot be renamed.`,
    );
  }

  // Stop another category from claiming the reserved fallback name.
  if (
    !existingIsProtected &&
    nextName.toLowerCase() === PROTECTED_CATEGORY.toLowerCase()
  ) {
    throw new Error(`"${PROTECTED_CATEGORY}" is a reserved category name.`);
  }

  try {
    await db.run("UPDATE categories SET name = ?, color = ? WHERE id = ?;", [
      nextName,
      nextColor,
      id,
    ]);

    // Expenses store the category name, so a rename has to follow through.
    if (nextName !== existing.name) {
      await db.run(
        "UPDATE expenses SET category = ?, updated_at = ? WHERE category = ?;",
        [nextName, new Date().toISOString(), existing.name],
      );

      await reassignShortcutCategory(existing.name, nextName);
    }
  } catch (error) {
    throw friendlyError(error, "Could not update the category.");
  }

  notifyDataChanged();

  return { ...existing, name: nextName, color: nextColor };
}

export async function getExpenseCountForCategory(name) {
  const db = await initializeDatabase();
  const result = await db.query(
    "SELECT COUNT(*) AS count FROM expenses WHERE category = ?;",
    [name],
  );

  return Number(result.values?.[0]?.count ?? 0);
}

export async function deleteCategory(id) {
  const db = await initializeDatabase();
  const existing = await getCategoryById(id);

  if (!existing) {
    return false;
  }

  if (existing.name.toLowerCase() === PROTECTED_CATEGORY.toLowerCase()) {
    throw new Error(
      `"${PROTECTED_CATEGORY}" is the fallback category and cannot be deleted.`,
    );
  }

  const otherResult = await db.query(
    "SELECT name FROM categories WHERE name = ? COLLATE NOCASE LIMIT 1;",
    [PROTECTED_CATEGORY],
  );

  const fallbackName = otherResult.values?.[0]?.name;

  if (!fallbackName) {
    const orderResult = await db.query(
      "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM categories;",
    );

    await db.run(
      `INSERT INTO categories (name, color, sort_order, created_at)
       VALUES (?, ?, ?, ?);`,
      [
        PROTECTED_CATEGORY,
        FALLBACK_CATEGORY_COLOR,
        Number(orderResult.values?.[0]?.max_order ?? 0) + 1,
        new Date().toISOString(),
      ],
    );
  }

  // Never lose expenses: move them to the fallback bucket before deleting.
  await db.run(
    "UPDATE expenses SET category = ?, updated_at = ? WHERE category = ?;",
    [
      fallbackName ?? PROTECTED_CATEGORY,
      new Date().toISOString(),
      existing.name,
    ],
  );

  await db.run("DELETE FROM categories WHERE id = ?;", [id]);

  await reassignShortcutCategory(
    existing.name,
    fallbackName ?? PROTECTED_CATEGORY,
  );

  notifyDataChanged();

  return true;
}

export async function reorderCategories(categories) {
  const db = await initializeDatabase();

  try {
    // Save the new position of each category.
    for (let index = 0; index < categories.length; index++) {
      await db.run("UPDATE categories SET sort_order = ? WHERE id = ?;", [
        index + 1,
        categories[index].id,
      ]);
    }

    notifyDataChanged();
  } catch (error) {
    throw friendlyError(error, "Could not reorder categories.");
  }
}
