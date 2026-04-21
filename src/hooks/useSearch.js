// src/hooks/useSearch.js
import { useState, useEffect } from "react";

export function useSearch(initialValue = "", delay = 250) {
  const [query,          setQuery]     = useState(initialValue);
  const [debouncedQuery, setDebounced] = useState(initialValue);

  useEffect(() => {
    // NOTE: trim() is intentionally NOT applied here so the input value
    // stays in sync with what the user typed (no cursor-jump on spaces).
    // Trim in your filter logic instead: debouncedQuery.trim().toLowerCase()
    const timer = setTimeout(() => setDebounced(query), delay);
    return () => clearTimeout(timer);
  }, [query, delay]);

  return [query, setQuery, debouncedQuery];
}