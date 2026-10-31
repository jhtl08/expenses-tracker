import { useEffect, useRef, useState } from "react";
import { ColorPicker, Modal } from "./Components.jsx";
import {
  addCategory,
  deleteCategory,
  updateCategory,
  reorderCategories,
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
  // Category currently being dragged.
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);

  // Long-press timer.
  const pressTimer = useRef(null);
  const wasDragging = useRef(false);

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
      flash(
        `Deleted "${category.name}". Expenses moved to ${PROTECTED_CATEGORY}.`,
      );
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy(false);
    }
  };

  /*
   * Start the long-press timer.
   * Holding a category for 300 ms activates dragging.
   */
  const startPress = (id) => {
    if (editingId !== null || busy) return;

    clearTimeout(pressTimer.current);

    pressTimer.current = setTimeout(() => {
      wasDragging.current = true;
      setDraggingId(id);
    }, 300);
  };

  /*
   * Cancel a pending long press.
   */
  const cancelPress = () => {
    clearTimeout(pressTimer.current);
  };

  /*
   * Track which category the dragged category is hovering over.
   */
  const handlePointerMove = (event) => {
    if (draggingId === null) return;

    const element = document.elementFromPoint(event.clientX, event.clientY);

    const row = element?.closest("[data-category-id]");

    if (!row) {
      setDropTargetId(null);
      return;
    }

    const targetId = row.dataset.categoryId;

    if (String(targetId) === String(draggingId)) {
      setDropTargetId(null);
      return;
    }

    setDropTargetId(targetId);
  };

  /*
   * Finish dragging and swap category positions.
   */
  const endPress = () => {
    clearTimeout(pressTimer.current);

    if (draggingId !== null && dropTargetId !== null) {
      const fromIndex = categories.findIndex(
        (category) => String(category.id) === String(draggingId),
      );

      const toIndex = categories.findIndex(
        (category) => String(category.id) === String(dropTargetId),
      );

      if (fromIndex !== -1 && toIndex !== -1) {
        const updated = [...categories];

        [updated[fromIndex], updated[toIndex]] = [
          updated[toIndex],
          updated[fromIndex],
        ];

        // Update the displayed order and persist it.
        // See the database changes in section 4.
        handleReorder(updated);
      }
    }

    setDraggingId(null);
    setDropTargetId(null);

    setTimeout(() => {
      wasDragging.current = false;
    }, 0);
  };

  /*
   * Clean up the timer when the component unmounts.
   */
  useEffect(() => {
    return () => {
      clearTimeout(pressTimer.current);
    };
  }, []);

  const handleReorder = async (updated) => {
    try {
      await reorderCategories(updated);
    } catch (error) {
      setError(error.message);
    }
  };

  // Hooks must all run before this early return, so it stays below them.
  if (!open) {
    return null;
  }

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
            const isDragging = draggingId === category.id;
            const isDropTarget = String(dropTargetId) === String(category.id);

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
                data-category-id={category.id}
                onPointerDown={(event) => {
                  if (event.target.closest("button")) return;
                  startPress(category.id);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={endPress}
                onPointerCancel={endPress}
                onPointerLeave={() => {
                  if (draggingId === null) {
                    cancelPress();
                  }
                }}
                className={`
                  flex items-center gap-3 rounded-xl border px-3 py-2.5
                  touch-none select-none
                  transition-all duration-200
                  ${
                    isDragging
                      ? "scale-[0.98] border-zinc-600 bg-zinc-900/60 opacity-50"
                      : "border-white/[0.06] bg-white/[0.02]"
                  }
                  ${
                    isDropTarget
                      ? "ring-2 ring-zinc-500 ring-offset-2 ring-offset-[#0d0f12]"
                      : ""
                  }
                `}
              >
                {/* Drag handle */}
                <span className="shrink-0 cursor-grab text-zinc-600 active:cursor-grabbing">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <circle cx="9" cy="6" r="1.5" />
                    <circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" />
                    <circle cx="15" cy="18" r="1.5" />
                  </svg>
                </span>

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
