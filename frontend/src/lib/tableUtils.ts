// ============================================================================
// Small client-side table helpers — sorting and multi-field search over an
// already-fetched array. No pagination/backend params exist for these
// endpoints, so this is intentionally plain array sort/filter.
// ============================================================================

/** Null-safe, locale-aware ascending string comparator (nulls sort as ''). */
export function compareValues(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? '').localeCompare(b ?? '');
}

/** True if `query` is empty, or a case-insensitive substring of any field. */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? '').toLowerCase().includes(q));
}
