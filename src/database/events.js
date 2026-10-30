// A very small change bus. Services notify after a successful write and the
// pages subscribe through the `useDataVersion` hook. This keeps the pages in
// sync without pulling in a state management library.

const listeners = new Set();

export function notifyDataChanged() {
  for (const listener of [...listeners]) {
    listener();
  }
}

export function subscribeToDataChanges(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
