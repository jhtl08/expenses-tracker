import { useEffect, useState } from "react";
import { getCategories } from "../database/categories.js";
import { subscribeToDataChanges } from "../database/events.js";

/**
 * Increments whenever a write happens through the database services.
 * Add it to a data-loading effect to refresh the page after mutations.
 */
export function useDataVersion() {
  const [version, setVersion] = useState(0);

  useEffect(
    () => subscribeToDataChanges(() => setVersion((current) => current + 1)),
    [],
  );

  return version;
}

export function useCategories() {
  const version = useDataVersion();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getCategories()
      .then((rows) => {
        if (active) {
          setCategories(rows);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error("Failed to load categories:", error);
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [version]);

  return { categories, loading };
}
