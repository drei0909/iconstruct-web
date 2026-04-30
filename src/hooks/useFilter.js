

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