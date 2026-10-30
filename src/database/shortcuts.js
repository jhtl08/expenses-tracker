import { DEFAULT_SHORTCUTS } from "./defaults.js";
import { notifyDataChanged } from "./events.js";
import { getSetting, setSetting } from "./settings.js";

const SHORTCUTS_KEY = "shortcuts.v1";

function normalizeShortcut(shortcut, index) {
  const amount = Number(shortcut?.amount);

  return {
    id:
      Number.isFinite(Number(shortcut?.id)) && shortcut?.id !== null
        ? Number(shortcut.id)
        : Date.now() + index,
    title: String(shortcut?.title ?? "").trim(),
    amount: Number.isFinite(amount) ? amount : 0,
    category: String(shortcut?.category ?? "").trim(),
    notes: String(shortcut?.notes ?? ""),
  };
}

export async function getShortcuts() {
  const stored = await getSetting(SHORTCUTS_KEY, null);

  if (!Array.isArray(stored)) {
    const seeded = DEFAULT_SHORTCUTS.map(normalizeShortcut);
    await setSetting(SHORTCUTS_KEY, seeded);
    return seeded;
  }

  return stored
    .map(normalizeShortcut)
    .filter((shortcut) => shortcut.title.length > 0);
}

export async function saveShortcuts(shortcuts) {
  const normalized = shortcuts.map(normalizeShortcut);

  await setSetting(SHORTCUTS_KEY, normalized);
  notifyDataChanged();

  return normalized;
}
