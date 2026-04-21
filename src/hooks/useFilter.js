// src/hooks/useFilter.js
// ─────────────────────────────────────────────────────────────────────────────
// Active-filter hook. Manages which status/category chip is selected.
//
// Returns THREE values:
//   activeFilter  — current selection (e.g. "all", "pending", "Cement")
//   setFilter     — select a filter value
//   clearFilter   — reset back to the initialFilter (convenience shortcut)
//
// Usage:
//   const [filter, setFilter, clearFilter] = useFilter("all");
//
//   // In your filter logic:
//   const visible = shops.filter(s =>
//     filter === "all" || s.status === filter
//   );
//
//   // In your chip row:
//   <FilterChips
//     options={["all", "pending", "approved", "rejected"]}
//     active={filter}
//     onSelect={setFilter}
//   />
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";

/**
 * @param {string} initialFilter  Default filter value (default "all")
 * @returns {[string, Function, Function]}
 */
export function useFilter(initialFilter = "all") {
  const [activeFilter, setFilter] = useState(initialFilter);

  // clearFilter is memoised so it won't cause unnecessary re-renders when
  // passed as a prop to child components.
  const clearFilter = useCallback(
    () => setFilter(initialFilter),
    [initialFilter]
  );

  return [activeFilter, setFilter, clearFilter];
}