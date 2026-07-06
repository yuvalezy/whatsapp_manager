import { useState } from 'react';

export type SortDir = 'asc' | 'desc';

// ============================================================================
// useSortState — click-to-sort state for a table's column headers. Clicking a
// new column activates it ascending; clicking the active column flips the
// direction. No default key, so the initial render keeps whatever order the
// caller's rows already came in.
// ============================================================================

export function useSortState<K extends string>() {
  const [sortKey, setSortKey] = useState<K | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (key: K) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return { sortKey, sortDir, toggleSort };
}
