import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";

// Minimal CSV helpers used by the Overview's import/export actions.
// The format is `Date,Category,Amount,Notes` with standard quoting.

function quoteField(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(expenses) {
  const header = ["Date", "Category", "Amount", "Notes"].join(",");
  const rows = (expenses ?? []).map((expense) =>
    [
      quoteField(expense.date),
      quoteField(expense.category),
      quoteField(Number(expense.amount).toFixed(2)),
      quoteField(expense.notes ?? ""),
    ].join(","),
  );

  return [header, ...rows].join("\r\n");
}

export async function downloadCsv(filename, csv) {
  // On native (Android) write the file straight to the app's Documents folder
  // so it is saved locally without opening a share sheet.
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Filesystem.writeFile({
        path: filename,
        data: csv,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });

      const uri = result.uri || (await Filesystem.getUri({
        path: filename,
        directory: Directory.Documents,
      })).uri;

      window.alert(`Saved ${filename} to Documents.\n${uri}`);
      return;
    } catch (error) {
      console.warn("Native file write failed, falling back:", error);
    }
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  // Web: prefer the native share sheet when it can carry a file.
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof File !== "undefined"
  ) {
    const file = new File([blob], filename, { type: "text/csv" });

    try {
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: filename,
          files: [file],
        });
        return;
      }
    } catch (error) {
      console.warn("Share failed, falling back to download link:", error);
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// A small CSV parser that handles quoted fields and CRLF/LF line endings.
// Returns { rows, errors } where rows are { date, category, amount, notes }.
export function parseCsv(text) {
  const lines = splitCsvRows(text);
  const rows = [];
  const errors = [];

  if (lines.length === 0) {
    return { rows, errors };
  }

  // Detect a header row.
  let startIndex = 0;
  const first = lines[0].map((value) => value.trim().toLowerCase());

  if (
    first.length >= 3 &&
    first[0] === "date" &&
    first[1] === "category" &&
    first[2] === "amount"
  ) {
    startIndex = 1;
  }

  lines.slice(startIndex).forEach((fields, index) => {
    const lineNumber = startIndex + index + 1;

    if (fields.every((value) => String(value).trim() === "")) {
      return;
    }

    const date = String(fields[0] ?? "").trim();
    const category = String(fields[1] ?? "").trim();
    const amountText = String(fields[2] ?? "").trim();
    const notes = String(fields[3] ?? "").trim();
    const amount = Number(amountText);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Line ${lineNumber}: invalid date "${date}".`);
      return;
    }

    if (!category) {
      errors.push(`Line ${lineNumber}: missing category.`);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Line ${lineNumber}: invalid amount "${amountText}".`);
      return;
    }

    rows.push({ date, category, amount, notes });
  });

  return { rows, errors };
}

function splitCsvRows(text) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;
  let atFieldStart = true;

  const pushField = () => {
    current.push(field);
    field = "";
    atFieldStart = true;
  };

  const pushRow = () => {
    if (current.length > 0 || field !== "") {
      if (current.length === 0 && field === "") {
        // skip completely empty trailing row
      } else {
        pushField();
        rows.push(current);
        current = [];
      }
    }
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (atFieldStart && char === '"') {
      inQuotes = true;
      atFieldStart = false;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else if (char === "\r") {
      if (next === "\n") {
        index += 1;
      }
      pushRow();
    } else {
      field += char;
      atFieldStart = false;
    }
  }

  // Flush the final field/row.
  if (field !== "" || current.length > 0) {
    pushField();
    rows.push(current);
  }

  return rows;
}
