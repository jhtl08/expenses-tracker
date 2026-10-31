# Expense Tracker

A mobile-first personal expense tracker. Log what you spend, tap saved shortcuts for everyday purchases, and review spending over any date range with totals, breakdowns, and charts.

It is a React + Vite single-page app wrapped with [Capacitor](https://capacitorjs.com/) for Android. All data lives on the device in SQLite, so the app works offline and needs no account or server.

The same code also runs in a desktop/mobile browser (`npm run dev`). In the browser it uses a `sql.js` database kept in `localStorage`, so you can develop and test the UI without an Android device.

---

## Table of contents

- [Features](#features)
- [How the app is organised](#how-the-app-is-organised)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting started (web)](#getting-started-web)
- [Getting started (Android)](#getting-started-android)
- [Command reference](#command-reference)
- [Configuration](#configuration)
- [Data storage and persistence](#data-storage-and-persistence)
- [Troubleshooting](#troubleshooting)
- [Contributing notes](#contributing-notes)

---

## Features

### Navigation

The app has three pages, reached through the bottom navigation bar or by swiping left and right (a swipe must cover at least 20% of the screen width). Each page scrolls independently.

| Page | Purpose |
| --- | --- |
| **Overview** (`◉`) | Analytics and transaction history for a chosen date range |
| **Entry** (`＋`) | Record a new expense, and edit or delete recent ones |
| **Shortcuts** (`⚡`) | One-tap buttons for expenses you log often |

The date chosen on the Entry page is also used when you tap a shortcut, so you can backfill yesterday's lunch by changing the date first.

### Overview

- **Date range presets:** This Month, Last Month, Last 3 Months, Last 12 Months, Last 3 Years, or Custom (pick a start and end date).
- **Summary stats:** total spend, transaction count, average per day, average per expense, top category, largest expense, top spending day, and number of active days.
- **Category breakdown:** a horizontal stacked bar with a legend and the percentage of spend per category.
- **Spending over time:** a stacked bar chart per category. It switches to monthly buckets automatically for ranges longer than 62 days, and you can toggle day or month at any time.
- **Transaction list:** 10 per page with Previous/Next controls and a "Showing A–B of N" counter. Deleting uses a two-click `Confirm?` button.
- **Persistent filters:** the selected range and custom dates are saved and restored on the next launch.

### Entry

- Add an expense with date, category, amount, and optional notes.
- The five most recent expenses (across all dates) are listed underneath.
- **Edit** loads an expense back into the form. The submit button changes to *Update Expense* and rewrites the existing row, so no duplicate is created.
- **Delete** uses a two-click confirmation. The list then pulls the next most recent expense into view.

### Shortcuts

- Each shortcut has a title, amount, category, and optional notes.
- **Tap** a shortcut to insert an expense for the selected date.
- **Long-press** a shortcut and drag it to reorder. A drop-target highlight shows where it will land. The order is saved.
- Use the **edit** button on a card to open the shortcut editor, where you can change it or **delete** it. The add-shortcut form uses the same editor.
- Three example shortcuts (Lunch, Jeepney, Coffee) are created on first run.

### Categories

- Categories are stored in their own table and are shared by Entry, Overview, and Shortcuts.
- Default categories on first run: Groceries, Food, Transportation, Rent, Utilities, Shopping, Health, Entertainment, and Other.
- From the category manager (opened from Entry or Shortcuts) you can **add**, **rename**, and **delete** categories, and pick each one's colour from a palette. Deleting also uses a two-click `Confirm?` button.
- **Other** is protected. It cannot be renamed or deleted.
- Deleting a category moves its expenses to **Other**. Renaming a category updates existing expenses and shortcuts that use it.
- Deleted default categories are not re-seeded on the next launch.

### CSV import and export

- **Export CSV** (Overview) downloads the expenses in the selected range as `expenses_START_to_END.csv` with columns `Date,Category,Amount,Notes`.
- **Import CSV** (Overview) reads a CSV file with the same columns (a header row is optional), validates each row, auto-creates any category that does not exist yet, and reports how many rows were imported or skipped.
- Invalid rows (bad date, missing category, non-positive amount) are skipped and listed in the browser console.

---

## How the app is organised

```
UI pages (components/)
      │  call
      ▼
Service layer (database/*.js)   ── expenses, categories, shortcuts, settings
      │  uses                     ── writes call notifyDataChanged()
      ▼
Connection (database/database.js)
      │
      ├── Android / native ─► @capacitor-community/sqlite  (SQLite file on device)
      └── Browser / web    ─► sql.js + localStorage         (webDatabase.js)
```

- **One database, three tables:** `expenses`, `categories`, and `settings`. Settings (shortcut list, Overview filters) are stored as JSON in `settings`, so there is no separate preferences store.
- **Schema versioning:** `database.js` runs `CREATE TABLE IF NOT EXISTS` statements on every launch, adds missing columns (for example `updated_at`), seeds default categories only on an empty table, and backfills any category name found in `expenses` that is missing from `categories`.
- **Change notifications:** services call `notifyDataChanged()` after each successful write. The `useDataVersion()` and `useCategories()` hooks in `src/hooks/useDatabase.js` re-run queries when that happens, so pages stay in sync without a state library.
- **Dates:** stored as local `YYYY-MM-DD` strings. This sorts correctly and avoids timezone shifts. Date maths lives in `src/utils/date.js`.
- **Startup:** `App.jsx` shows a loading spinner while the database opens. If that fails, it shows the error and a *Try again* button.

### Data model

| Table | Columns | Notes |
| --- | --- | --- |
| `expenses` | `id`, `date`, `category`, `amount`, `notes`, `created_at`, `updated_at` | Indexed on `date` and `category`. Amounts must be positive; `date` and `category` are required. |
| `categories` | `id`, `name` (unique, case-insensitive), `color`, `sort_order`, `created_at` | `Other` is protected by name. |
| `settings` | `key`, `value` (JSON text), `updated_at` | Keys used: `shortcuts.v1`, `overview.filters.v1`. |

---

## Tech stack

| Area | Library |
| --- | --- |
| UI | React 19, Tailwind CSS 4 |
| Build / dev server | Vite 8, `@vitejs/plugin-react` |
| Mobile shell | Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`) |
| Native storage | `@capacitor-community/sqlite` |
| Browser storage | `sql.js` (SQLite compiled to WebAssembly) |
| Charts | Chart.js 4, `react-chartjs-2` |
| Linting | ESLint 10 with React Hooks and React Refresh plugins |

---

## Project structure

```
expenses-tracker/
├── android/                      # Native Android project (Gradle, generated by Capacitor)
│   └── app/src/main/             # AndroidManifest, MainActivity, web assets copied on sync
├── dist/                         # Production web build (output of `npm run build`, git-ignored)
├── public/
│   ├── favicon.svg               # Browser tab icon
│   └── assets/sql-wasm.wasm      # sql.js WebAssembly binary used by the browser build
├── src/
│   ├── App.jsx                   # Page shell, swipe navigation, bottom nav, DB startup
│   ├── main.jsx                  # React entry point
│   ├── index.css / App.css       # Tailwind and global styles
│   ├── components/
│   │   ├── EntryPage.jsx         # Add / edit / delete expenses
│   │   ├── OverviewPage.jsx      # Filters, stats, transaction list
│   │   ├── ExpenseCharts.jsx     # Category bar and over-time charts
│   │   ├── ShortcutsPage.jsx     # Shortcut grid, reorder, add / edit
│   │   ├── CategoryManager.jsx   # Add / rename / delete categories (modal)
│   │   └── Components.jsx        # Shared Modal, ColorPicker, FormField, DatePicker, Footer
│   ├── database/
│   │   ├── database.js           # Connection, native/web selection, schema, seeding
│   │   ├── webDatabase.js        # sql.js adapter with localStorage persistence
│   │   ├── expenses.js           # Expense CRUD and range / category queries
│   │   ├── categories.js         # Category CRUD and reassignment rules
│   │   ├── shortcuts.js          # Shortcut list (stored in settings)
│   │   ├── settings.js           # JSON key/value settings
│   │   ├── defaults.js           # Default categories, shortcuts, colour palette
│   │   └── events.js             # notifyDataChanged / subscribe
│   ├── hooks/useDatabase.js      # useDataVersion, useCategories
│   └── utils/
│       ├── analytics.js          # Range aggregation and chart series
│       ├── csv.js                # CSV parse and download helpers
│       ├── date.js               # Local date helpers, presets, granularity
│       └── format.js             # Currency and percent formatting
├── capacitor.config.json         # Capacitor app ID, name, web dir, SQLite plugin options
├── eslint.config.js
├── index.html
├── package.json
├── vite.config.js
└── PLAN.md                       # Implementation notes and phase checklist
```

---

## Prerequisites

| Tool | Needed for | Notes |
| --- | --- | --- |
| **Node.js** and npm | Everything | Vite 8 needs Node 20.19+ or 22.12+ (a current LTS release is fine). |
| **Git** | Cloning | |
| **Android Studio** | Android builds | Installs the Android SDK, platform tools (`adb`), and a bundled JDK. |
| **JDK 21** | Gradle builds | `android/app/capacitor.build.gradle` compiles with Java 21. Android Studio's bundled JBR is sufficient. |
| **Android SDK** | Android builds | compileSdk 36, targetSdk 36, minSdk 24 (Android 7.0). Install through Android Studio's SDK Manager. |
| **An Android device or emulator** | Running the app | Enable USB debugging on a physical device. |

Make sure `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) points to your SDK if you use the command line. On Windows the default is `%LOCALAPPDATA%\Android\Sdk`.

---

## Getting started (web)

Use this path for UI work and quick testing. No Android tooling is needed.

```bash
# 1. Clone and install dependencies
git clone <your-repo-url> expenses-tracker
cd expenses-tracker
npm install

# 2. Start the dev server
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Data is saved in the browser's `localStorage` under the key `expense_tracker.web.sqlite`, so it survives reloads but is separate for each browser profile and origin.

To test the production build locally:

```bash
npm run build
npm run preview
```

---

## Getting started (Android)

Native Android uses the real SQLite plugin. Any change to web code (`src/`) must be built and synced into the Android project before it appears on the device.

### Option A: Android Studio

```bash
npm install
npm run build
npx cap sync android
npx cap open android
```

In Android Studio, wait for Gradle sync to finish, choose a device or emulator, and press **Run ▶**.

### Option B: command line (Windows PowerShell or cmd)

```powershell
npm install
npm run build
npx cap sync android
npx cap run android          # builds and launches on a connected device/emulator
```

To build the APK without launching it:

```powershell
cd android
gradlew.bat :app:assembleDebug
```

The debug APK is written to `android\app\build\outputs\apk\debug\app-debug.apk`. Install it on a connected device with:

```powershell
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

On macOS or Linux, use `./gradlew` in place of `gradlew.bat`.

### What `cap sync` does

`npx cap sync android` copies `dist/` into `android/app/src/main/assets/public` and updates the native plugin list (`capacitor.plugins.json`). Run it after every `npm run build` that you want to see on the device. Skipping it means the app keeps running the old web bundle.

### Release builds

The Gradle `release` build type is not configured with a signing key. To produce a store-ready build, use **Build → Generate Signed App Bundle / APK** in Android Studio and follow the keystore prompts. Keep the keystore and its passwords safe. Losing them means you cannot publish updates under the same app ID.

---

## Command reference

### npm scripts (run from the project root)

| Command | What it does |
| --- | --- |
| `npm install` | Installs dependencies from `package-lock.json`. |
| `npm run dev` | Starts the Vite dev server with hot reload (browser storage). |
| `npm run build` | Produces the optimised web bundle in `dist/`. |
| `npm run preview` | Serves the built `dist/` locally to test the production bundle. |
| `npm run lint` | Runs ESLint over the project (excludes `dist/` and `android/`). |

### Capacitor CLI (Android)

| Command | What it does |
| --- | --- |
| `npx cap sync android` | Copies `dist/` into the Android project and updates native plugins. |
| `npx cap sync` | Same as above for all configured platforms. |
| `npx cap open android` | Opens the `android/` project in Android Studio. |
| `npx cap run android` | Builds, installs, and launches the app on a connected device or emulator. |
| `npx cap copy android` | Copies web assets only (no plugin update). |
| `npx cap doctor` | Checks the Capacitor and Android environment for common problems. |

### Gradle (run from `android/`)

| Command | What it does |
| --- | --- |
| `gradlew.bat :app:assembleDebug` | Builds the debug APK. |
| `gradlew.bat :app:installDebug` | Builds and installs the debug APK on a connected device. |
| `gradlew.bat :app:bundleRelease` | Builds a release AAB. Requires a signing config (see [Release builds](#release-builds)). |
| `gradlew.bat clean` | Deletes Gradle build output. |

### Typical workflows

```bash
# Day-to-day UI work in the browser
npm run dev

# Check the change works on Android
npm run build && npx cap sync android && npx cap run android

# Before committing
npm run lint && npm run build
```

---

## Configuration

| File | Setting | Purpose |
| --- | --- | --- |
| `capacitor.config.json` | `appId` | Capacitor's app identifier. Must match the Android `applicationId` (currently `com.example.expensetracker`). |
| `capacitor.config.json` | `appName` | Display name used by Capacitor tooling. |
| `capacitor.config.json` | `webDir` | Web build folder to sync (`dist`). |
| `capacitor.config.json` | `plugins.CapacitorSQLite` | Plugin options: `androidIsEncryption` / `iosIsEncryption` are `false`, so the database is not encrypted at rest. |
| `android/app/build.gradle` | `applicationId`, `versionCode`, `versionName` | The ID and version that Android uses. |
| `android/variables.gradle` | `minSdkVersion`, `compileSdkVersion`, `targetSdkVersion` | Android SDK levels. |
| `src/database/defaults.js` | `DEFAULT_CATEGORIES`, `DEFAULT_SHORTCUTS`, `CATEGORY_COLORS` | Seed data and palette used on first run. Changing these does not affect existing installs. |
| `src/database/database.js` | `DATABASE_NAME`, `DATABASE_VERSION` | Database name and schema version. |

> **Note:** `appId` in `capacitor.config.json` and `applicationId` in `android/app/build.gradle` are both `com.example.expensetracker`. Changing the ID later installs the app as a new app, so existing on-device data will not carry over. Change both values together.

---

## Data storage and persistence

| Platform | Storage | Where it lives |
| --- | --- | --- |
| Android | `@capacitor-community/sqlite`, database `expense_tracker`, no encryption | The app's private storage on the device. Uninstalling the app deletes the data. |
| Browser (`npm run dev` / `preview`) | `sql.js` database, base64-encoded in `localStorage` key `expense_tracker.web.sqlite` | The browser profile. Clearing site data deletes it. Browsers cap `localStorage` at roughly 5 MB, which is plenty for typical use but not for very large histories. |

The browser and Android databases are separate. Data entered in the browser will not appear on the phone, and vice versa.

**Backup and export:** the app does not yet have an export or import feature. On Android, `android:allowBackup="true"` is set in the manifest, so Android's cloud backup may include the app data depending on device settings. Do not rely on this as your only copy.

**Resetting the browser database:** in DevTools, run `localStorage.removeItem("expense_tracker.web.sqlite")` and reload.

**Resetting the Android database:** uninstall the app, or clear its storage in Android settings.

---

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| *"Could not open the database"* screen | The error message is shown on screen. Tap **Try again**. If it persists on Android, reinstall the app. On the web, clear the `localStorage` key above. |
| Android app shows old UI after a code change | You did not rebuild and sync. Run `npm run build && npx cap sync android`, then run again. |
| `Gradle` fails with a Java version error | Use JDK 21. In Android Studio, set **Settings → Build Tools → Gradle → Gradle JDK** to the bundled JBR or a JDK 21 install. |
| `SDK location not found` | Set `ANDROID_HOME` or create `android/local.properties` with `sdk.dir=<path to SDK>`. |
| `npx cap run android` cannot find a device | Run `adb devices`. Enable USB debugging, accept the prompt on the phone, or start an emulator. |
| Web build page is blank | Open DevTools (F12) and check the console. Make sure you are using `npm run preview` or `npm run dev`, not opening `dist/index.html` directly from disk. |
| Chart shows nothing | There are no expenses in the selected range. Pick a wider preset or check the custom dates. |

---

## Contributing notes

- Keep database access inside `src/database/`. Pages should call the service functions, not run SQL directly.
- After writing data, call `notifyDataChanged()` (done by the existing service functions) so other pages refresh.
- Store anything that must survive restarts through `setSetting` / `getSetting` rather than `localStorage` on native.
- Run `npm run lint` and `npm run build` before committing. Run `npx cap sync android` and check the device when you change native-facing behaviour.
- `PLAN.md` records the design decisions, the phased implementation checklist, and the manual test matrix used so far.
