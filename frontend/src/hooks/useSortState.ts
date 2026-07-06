import { useState } from 'react';

export type SortDir = 'asc' | 'desc';

// ============================================================================
// useSortState — click-to-sort state for a table's column headers. Clicking a
// new column activates it ascending; clicking the active column flips the
// direction. No default key, so the initial render keeps whatever order the
// caller's rows already came in.
// ============================================================================

export function useSortState<K extends string>(initialKey: K | null = null, initialDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState<K | null>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);

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
