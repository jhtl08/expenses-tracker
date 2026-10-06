import { DatePicker, Footer } from "../components/Components.jsx";
import { useEffect, useRef, useState } from "react";

const categories = [
  "Groceries",
  "Food",
  "Transportation",
  "Rent",
  "Utilities",
  "Other",
];

const initialShortcuts = [
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

export function Shortcuts({ selectedDate, setSelectedDate }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-8 sm:px-8">
      {/* Header */}
      <header className="mb-8 text-center">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          Quick-Add Expenses
        </p>

        <DatePicker
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
      </header>

      {/* Page Content */}
      <main className="flex-1">
        <ShortcutsCards
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export function ShortcutsCards({ selectedDate, setSelectedDate }) {
  const [shortcuts, setShortcuts] = useState(initialShortcuts);

  // Shortcut just clicked to add expense (prevent multiple clicks).
  const [isAdding, setIsAdding] = useState(false);

  // null = no editor
  // "new" = adding a shortcut
  // number = editing an existing shortcut
  const [editingId, setEditingId] = useState(null);

  // Shortcut currently being dragged.
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);

  // Shortcut currently showing "Expense Added".
  const [feedbackId, setFeedbackId] = useState(null);

  // Long-press timer.
  const pressTimer = useRef(null);
  const wasDragging = useRef(false);

  /*
   * Add an expense using a shortcut.
   */
  const addExpense = (shortcut) => {
    if (isAdding) return;
    setIsAdding(true);

    console.log("Adding expense:", {
      date: selectedDate.toISOString().split("T")[0],
      title: shortcut.title,
      amount: shortcut.amount,
      category: shortcut.category,
      notes: shortcut.notes,
    });

    // Show feedback.
    setFeedbackId(shortcut.id);

    // Hide feedback after 1.2 seconds.
    setTimeout(() => {
      setFeedbackId(null);
      setIsAdding(false);
    }, 1000);
  };

  /*
   * Save an existing shortcut or create a new one.
   */
  const saveShortcut = (shortcut) => {
    if (editingId === "new") {
      setShortcuts((prev) => [
        ...prev,
        {
          ...shortcut,
          id: Date.now(),
        },
      ]);
    } else {
      setShortcuts((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...shortcut,
              }
            : item,
        ),
      );
    }

    setEditingId(null);
  };

  /*
   * Delete the shortcut currently being edited.
   */
  const deleteShortcut = () => {
    setShortcuts((prev) =>
      prev.filter((shortcut) => shortcut.id !== editingId),
    );

    setEditingId(null);
  };

  /*
   * Start the long-press timer.
   *
   * Holding the card for 600 ms immediately puts it
   * into dragging mode.
   */
  const startPress = (id) => {
    if (editingId !== null) return;

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
   * Handle pointer movement while dragging.
   *
   * When the dragged card moves over another shortcut,
   * their positions are remembered for swapping when pointer is released.
   */
  const handlePointerMove = (event) => {
    if (draggingId === null) return;

    const element = document.elementFromPoint(event.clientX, event.clientY);

    const card = element?.closest("[data-shortcut-id]");

    if (!card) {
      setDropTargetId(null);
      return;
    }

    const targetId = Number(card.dataset.shortcutId);

    if (targetId === draggingId) {
      setDropTargetId(null);
      return;
    }

    setDropTargetId(targetId);
  };

  /*
   * End the current pointer interaction.
   */
  const endPress = () => {
    clearTimeout(pressTimer.current);

    if (draggingId !== null && dropTargetId !== null) {
      setShortcuts((prev) => {
        const fromIndex = prev.findIndex(
          (shortcut) => shortcut.id === draggingId,
        );

        const toIndex = prev.findIndex(
          (shortcut) => shortcut.id === dropTargetId,
        );

        if (fromIndex === -1 || toIndex === -1) {
          return prev;
        }

        const updated = [...prev];

        [updated[fromIndex], updated[toIndex]] = [
          updated[toIndex],
          updated[fromIndex],
        ];

        return updated;
      });
    }

    setDraggingId(null);
    setDropTargetId(null);

    setTimeout(() => {
      wasDragging.current = false;
    }, 0);
  };

  /*
   * Clean up the timer if the component disappears.
   */
  useEffect(() => {
    return () => {
      clearTimeout(pressTimer.current);
    };
  }, []);

  return (
    <section className="w-full">
      {/* Shortcut grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {shortcuts.map((shortcut) => {
          const isEditing = editingId === shortcut.id;
          const isDragging = draggingId === shortcut.id;
          const showFeedback = feedbackId === shortcut.id;

          return (
            <div
              key={shortcut.id}
              data-shortcut-id={shortcut.id}
              onPointerDown={(event) => {
                // Do not start dragging when clicking the edit button.
                if (event.target.closest("[data-edit-button]")) {
                  return;
                }

                startPress(shortcut.id);
              }}
              onPointerMove={handlePointerMove}
              onPointerUp={endPress}
              onPointerCancel={endPress}
              onPointerLeave={() => {
                if (draggingId === null) {
                  cancelPress();
                }
              }}
              onClick={() => {
                if (
                  !wasDragging.current &&
                  draggingId === null &&
                  editingId === null
                ) {
                  addExpense(shortcut);
                }
              }}
              className={`
                relative flex min-h-44 min-w-0 flex-col
                overflow-hidden rounded-xl border p-3 sm:p-4
                touch-none select-none
                transition-all duration-200
                ${
                  isDragging
                    ? "scale-95 border-zinc-600 bg-zinc-900/60 opacity-50"
                    : "border-zinc-800 bg-[#111418] hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-[#13161a]"
                }
                ${showFeedback ? "border-emerald-500/50 bg-emerald-500/10" : ""}
                ${
                  editingId === shortcut.id
                    ? "cursor-default"
                    : "cursor-pointer"
                }
              `}
            >
              {/* Expense added feedback */}
              {showFeedback && (
                <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex justify-center">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300 shadow-lg backdrop-blur-sm">
                    Expense Added
                  </span>
                </div>
              )}

              {/* Edit button */}
              {!isEditing && (
                <button
                  type="button"
                  data-edit-button
                  aria-label={`Edit ${shortcut.title}`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    cancelPress();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingId(shortcut.id);
                  }}
                  className="
                    absolute right-2 top-2 z-20
                    flex h-8 w-8 items-center justify-center
                    rounded-lg
                    text-zinc-600
                    transition
                    hover:bg-zinc-800/80
                    hover:text-zinc-300
                    focus:outline-none
                    focus:ring-1
                    focus:ring-zinc-600
                  "
                >
                  {/* Pencil icon */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 20h9"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"
                    />
                  </svg>
                </button>
              )}

              {isEditing ? (
                <ShortcutEditor
                  shortcut={shortcut}
                  onSave={saveShortcut}
                  onDelete={deleteShortcut}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  {/* Title */}
                  <h2 className="min-w-0 pr-8 break-words text-base font-semibold leading-tight text-zinc-100">
                    {shortcut.title}
                  </h2>

                  {/* Amount */}
                  <p className="mt-2 break-words text-2xl font-semibold text-zinc-100">
                    ₱
                    {Number(shortcut.amount).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </p>

                  {/* Category */}
                  <span className="mt-3 w-fit max-w-full break-words rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs font-medium leading-tight text-zinc-400">
                    {shortcut.category}
                  </span>

                  {/* Notes */}
                  {shortcut.notes && (
                    <p className="mt-3 line-clamp-2 break-words text-xs leading-relaxed text-zinc-500">
                      {shortcut.notes}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* Add shortcut */}
        {editingId === "new" ? (
          <div className="min-h-44 min-w-0 overflow-hidden rounded-xl border border-dashed border-zinc-800 bg-[#0d0f12] p-3 text-zinc-100 sm:p-4">
            <ShortcutEditor
              onSave={saveShortcut}
              onCancel={() => setEditingId(null)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingId("new")}
            className="
              flex min-h-44 min-w-0 items-center justify-center
              rounded-xl border border-dashed border-zinc-800
              bg-[#101317]
              text-zinc-600
              transition
              hover:border-zinc-700
              hover:bg-[#13161a]
              hover:text-zinc-300
            "
          >
            <span className="text-4xl font-light">+</span>
          </button>
        )}
      </div>
    </section>
  );
}

function ShortcutEditor({ shortcut, onSave, onDelete, onCancel }) {
  const [form, setForm] = useState(
    shortcut ?? {
      title: "",
      amount: "",
      category: categories[0],
      notes: "",
    },
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.amount) {
      return;
    }

    onSave({
      ...form,
      title: form.title.trim(),
      amount: Number(form.amount),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      onClick={(event) => event.stopPropagation()}
      className="
        flex h-full min-h-0 min-w-0
        flex-col gap-3
        overflow-y-auto
      "
    >
      {/* Title */}
      <div className="min-w-0">
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          Title
        </label>

        <input
          type="text"
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="e.g. Lunch"
          autoFocus
          className="
            w-full min-w-0
            rounded-lg border border-zinc-800
            bg-[#0f1114]
            px-3 py-2
            text-sm text-zinc-100
            placeholder:text-zinc-600
            outline-none
            transition
            focus:border-zinc-600
          "
        />
      </div>

      {/* Amount */}
      <div className="min-w-0">
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          Amount
        </label>

        <input
          type="number"
          name="amount"
          value={form.amount}
          onChange={handleChange}
          placeholder="0.00"
          min="0"
          step="0.01"
          className="
            w-full min-w-0
            rounded-lg border border-zinc-800
            bg-[#0f1114]
            px-3 py-2
            text-sm text-zinc-100
            placeholder:text-zinc-600
            outline-none
            transition
            focus:border-zinc-600
          "
        />
      </div>

      {/* Category */}
      <div className="min-w-0">
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          Category
        </label>

        <select
          name="category"
          value={form.category}
          onChange={handleChange}
          className="
            w-full min-w-0
            rounded-lg border border-zinc-800
            bg-[#0f1114]
            px-3 py-2
            text-sm text-zinc-100
            outline-none
            transition
            focus:border-zinc-600
          "
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div className="min-w-0">
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          Notes
        </label>

        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          placeholder="Optional notes"
          rows={2}
          className="
            w-full min-w-0
            resize-none
            rounded-lg border border-zinc-800
            bg-[#0f1114]
            px-3 py-2
            text-sm text-zinc-100
            placeholder:text-zinc-600
            outline-none
            transition
            focus:border-zinc-600
          "
        />
      </div>

      {/* Actions */}
      <div className="mt-auto shrink-0 pt-2">
        {/* Finish / Cancel */}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="
              min-w-0 flex-1
              rounded-lg
              bg-zinc-100
              px-3 py-2
              text-sm font-medium
              text-zinc-900
              transition
              hover:bg-white
            "
          >
            Finish
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="
              min-w-[80px] flex-1
              rounded-lg
              border border-zinc-800
              bg-transparent
              px-3 py-2
              text-sm
              text-zinc-400
              transition
              hover:bg-zinc-900
              hover:text-zinc-200
            "
          >
            Cancel
          </button>
        </div>

        {/* Delete */}
        {shortcut && (
          <button
            type="button"
            onClick={onDelete}
            className="
              mt-2 w-full
              rounded-lg
              border border-red-950
              bg-transparent
              px-3 py-2
              text-sm
              text-red-400
              transition
              hover:bg-red-950/40
              hover:text-red-300
            "
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
