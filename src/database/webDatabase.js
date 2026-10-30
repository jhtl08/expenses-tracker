import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

// The web build of @capacitor-community/sqlite needs the `jeep-sqlite` custom
// element. This project only targets Android for real data, so instead of
// shipping a second SQLite engine we use sql.js directly for `npm run dev`.
// The adapter below mirrors the subset of the plugin API used by the services
// (execute / run / query) and persists the database to localStorage so that
// settings survive a browser reload while developing.

const STORAGE_KEY = "expense_tracker.web.sqlite";

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(index, index + chunkSize),
    );
  }

  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function readPersistedDatabase() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? base64ToBytes(stored) : null;
  } catch (error) {
    console.warn("Could not read the web database from localStorage:", error);
    return null;
  }
}

function writePersistedDatabase(bytes) {
  try {
    window.localStorage.setItem(STORAGE_KEY, bytesToBase64(bytes));
  } catch (error) {
    console.warn("Could not persist the web database:", error);
  }
}

export async function createWebDatabase() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const persisted = readPersistedDatabase();
  const database = persisted ? new SQL.Database(persisted) : new SQL.Database();

  const persist = () => {
    writePersistedDatabase(database.export());
  };

  const query = (sql, params = []) => {
    const statement = database.prepare(sql);

    try {
      if (params.length > 0) {
        statement.bind(params);
      }

      const values = [];

      while (statement.step()) {
        values.push(statement.getAsObject());
      }

      return { values };
    } finally {
      statement.free();
    }
  };

  const run = (sql, params = []) => {
    database.run(sql, params);

    const changes = database.getRowsModified();
    const lastId = database.exec("SELECT last_insert_rowid() AS id;")[0];

    persist();

    return {
      changes: {
        changes,
        lastId: lastId?.values?.[0]?.[0] ?? null,
      },
    };
  };

  const execute = (sql) => {
    database.exec(sql);
    const changes = database.getRowsModified();
    persist();

    return { changes: { changes } };
  };

  const close = async () => {
    persist();
    database.close();
  };

  return {
    platform: "web",
    execute,
    run,
    query,
    close,
    // Parity with the native plugin: on web every write is persisted right
    // away, so there is nothing extra to save.
    saveToStore: async () => persist(),
  };
}
