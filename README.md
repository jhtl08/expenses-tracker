# Expense Tracker

A mobile expense tracking app built with React + Vite and Capacitor, targeting Android. It stores data locally via SQLite (`@capacitor-community/sqlite`) and supports persistent configuration (shortcut ordering, overview filters, user-managed categories) across runs.

## What it does

- Track expenses with categories and dates.
- Manage custom categories (add, modify, delete) in SQLite.
- Persistent memory for settings like shortcut order, overview filter state, and category preferences.
- Overview page with date-range filtering (previous month, 3 months, 1 year, custom) and visual stats (stacked bar charts per category, spend totals).

## Tech stack

- React + Vite
- Capacitor (Android target)
- SQLite via `@capacitor-community/sqlite`
- ESLint for linting
