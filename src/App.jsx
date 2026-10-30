import { useEffect, useRef, useState } from "react";
// import { } from "./components/Components.jsx";
import { Entry } from "./components/EntryPage.jsx";
import { Overview } from "./components/OverviewPage.jsx";
import { Shortcuts } from "./components/ShortcutsPage.jsx";
import { initializeDatabase } from "./database/database.js";

const pages = [
  {
    id: "overview",
    title: "Overview",
    description: "View your expenses and analytics",
  },
  {
    id: "entry",
    title: "Expense Entry",
    description: "Add a new expense",
  },
  {
    id: "shortcuts",
    title: "Shortcuts",
    description: "Quickly add common expenses",
  },
];

function App() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [databaseState, setDatabaseState] = useState("loading");
  const [databaseError, setDatabaseError] = useState("");
  const [startupAttempt, setStartupAttempt] = useState(0);
  const touchStartX = useRef(null);

  // Open the SQLite database (and create/upgrade the schema) before showing
  // pages that would otherwise fire queries against an unopened connection.
  useEffect(() => {
    let active = true;

    initializeDatabase()
      .then(() => {
        if (active) {
          setDatabaseState("ready");
        }
      })
      .catch((error) => {
        console.error("Failed to initialize the database:", error);

        if (active) {
          setDatabaseError(error.message || "Unknown database error.");
          setDatabaseState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [startupAttempt]);

  const goToPage = (index) => {
    setCurrentPage(Math.max(0, Math.min(index, pages.length - 1)));
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const distance = touchEndX - touchStartX.current;

    const threshold = window.innerWidth * 0.2;

    if (Math.abs(distance) >= threshold) {
      if (distance < 0) {
        // Swipe left → next page
        goToPage(currentPage + 1);
      } else {
        // Swipe right → previous page
        goToPage(currentPage - 1);
      }
    }

    touchStartX.current = null;
  };

  if (databaseState === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0d0f12] px-6 text-center text-white">
        <div>
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white/80" />
          <p className="text-sm font-medium text-zinc-300">
            Opening your expense database…
          </p>
        </div>
      </main>
    );
  }

  if (databaseState === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0d0f12] px-6 text-white">
        <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-center">
          <p className="text-sm font-semibold text-red-300">
            Could not open the database
          </p>
          <p className="mt-2 break-words text-xs leading-relaxed text-zinc-500">
            {databaseError}
          </p>
          <button
            type="button"
            onClick={() => {
              setDatabaseError("");
              setDatabaseState("loading");
              setStartupAttempt((attempt) => attempt + 1);
            }}
            className="mt-4 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative h-dvh overflow-hidden bg-[#0d0f12] text-white"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pages */}
      <div
        className="flex h-full w-[300vw] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: `translateX(-${currentPage * 100}vw)`,
        }}
      >
        <section className="h-full w-screen shrink-0 overflow-y-auto overscroll-contain pb-20">
          <Overview />
        </section>

        <section className="h-full w-screen shrink-0 overflow-y-auto overscroll-contain pb-20">
          <Entry
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        </section>

        <section className="h-full w-screen shrink-0 overflow-y-auto overscroll-contain pb-20">
          <Shortcuts
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        </section>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 z-50 flex w-full border-t border-white/10 bg-[#0d0f12]/95 backdrop-blur-md">
        {pages.map((page, index) => (
          <button
            key={page.id}
            onClick={() => goToPage(index)}
            title={page.description}
            className={`group flex flex-1 flex-col items-center justify-center gap-1 py-3 transition ${
              currentPage === index
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="text-lg">
              {page.id === "overview" && "◉"}
              {page.id === "entry" && "＋"}
              {page.id === "shortcuts" && "⚡"}
            </span>

            <span className="text-xs font-medium">
              {page.id === "entry" ? "Entry" : page.title}
            </span>

            <span className="pointer-events-none absolute bottom-full mb-2 hidden w-max max-w-xs rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-300 shadow-lg group-hover:block">
              {page.description}
            </span>
          </button>
        ))}
      </nav>
    </main>
  );
}

export default App;
