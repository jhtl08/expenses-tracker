import { useState } from "react";
import { ColorPicker, Modal } from "./Components.jsx";
import {
  addCategory,
  deleteCategory,
  updateCategory,
} from "../database/categories.js";
import { PROTECTED_CATEGORY } from "../database/defaults.js";
import { useCategories } from "../hooks/useDatabase.js";

export function CategoryManager({ open, onClose }) {
  const { categories, loading } = useCategories();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#34d399");
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState("#34d399");
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!open) {
    return null;
  }

  const flash = (message, isError = false) => {
    setError(isError ? message : "");
    setNotice(isError ? "" : message);

    if (!isError) {
      window.setTimeout(() => setNotice(""), 2000);
    }
  };

  const startEditing = (category) => {
    setEditingId(category.id);
    setDraftName(category.name);
    setDraftColor(category.color);
    setPendingDeleteId(null);
    setError("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftName("");
    setDraftColor("#34d399");
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const created = await addCategory({ name: newName, color: newColor });
      setNewName("");
      setNewColor("#34d399");
      flash(`Added "${created.name}".`);
    } catch (addError) {
      setError(addError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const updated = await updateCategory(editingId, {
        name: draftName,
        color: draftColor,
      });
      setEditingId(null);
      flash(`Saved "${updated.name}".`);
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (category) => {
    if (pendingDeleteId !== category.id) {
      setPendingDeleteId(category.id);
      setError("");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await deleteCategory(category.id);
      setPendingDeleteId(null);
      flash(`Deleted "${category.name}". Expenses moved to ${PROTECTED_CATEGORY}.`);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Categories"
      description="Add, rename or remove spending categories. Renaming updates past expenses; deleting moves them to Other."
      onClose={onClose}
    >
      <div className="space-y-5">
        {error && (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {notice && (
          <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {notice}
          </p>
        )}

        <section className="space-y-2">
          {loading && categories.length === 0 && (
            <p className="py-4 text-center text-xs text-zinc-600">
              Loading categories…
            </p>
          )}

          {categories.map((category) => {
            const isEditing = editingId === category.id;
            const isProtected =
              category.name.toLowerCase() === PROTECTED_CATEGORY.toLowerCase();
            const confirmingDelete = pendingDeleteId === category.id;

            if (isEditing) {
              return (
                <form
                  key={category.id}
                  onSubmit={handleRename}
                  className="space-y-3 rounded-xl border border-white/[0.09] bg-white/[0.03] p-3"
                >
                  <input
                    autoFocus
                    value={draftName}
                    maxLength={32}
                    onChange={(event) => setDraftName(event.target.value)}
                    aria-label="Category name"
                    className="w-full rounded-lg border border-white/[0.08] bg-[#0f1114] px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-white/25"
                  />

                  <ColorPicker value={draftColor} onChange={setDraftColor} />

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="flex-1 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-50"
                    >
                      Save
                    </button>

                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="flex-1 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div
                key={category.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />

                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                  {category.name}
                </span>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEditing(category)}
                    aria-label={`Edit ${category.name}`}
                    className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    disabled={isProtected || busy}
                    onClick={() => handleDelete(category)}
                    title={
                      isProtected
                        ? `${PROTECTED_CATEGORY} is the fallback category`
                        : undefined
                    }
                    className={`rounded-lg px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-30 ${
                      confirmingDelete
                        ? "bg-red-500/15 text-red-300"
                        : "text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
                    }`}
                  >
                    {confirmingDelete ? "Confirm?" : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        <form
          onSubmit={handleAdd}
          className="space-y-3 rounded-xl border border-dashed border-white/[0.09] bg-[#0f1114] p-3"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            New category
          </p>

          <input
            value={newName}
            maxLength={32}
            placeholder="e.g. Subscriptions"
            onChange={(event) => setNewName(event.target.value)}
            aria-label="New category name"
            className="w-full rounded-lg border border-white/[0.08] bg-[#171a1f] px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-white/25"
          />

          <ColorPicker value={newColor} onChange={setNewColor} />

          <button
            type="submit"
            disabled={busy || !newName.trim()}
            className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add category
          </button>
        </form>
      </div>
    </Modal>
  );
}
