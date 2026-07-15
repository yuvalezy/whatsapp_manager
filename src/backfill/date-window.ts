// ============================================================================
// Backfill date-window parsing — the single authoritative source for how the
// manual backfill endpoints interpret their `from`/`since`/`to`/`until` fields.
// Kept pure (no Express, no services) so it can be unit-tested in isolation.
//
// Semantics (documented):
//  - `from`/`since` is the inclusive lower bound; `to`/`until` is the EXCLUSIVE
//    upper bound. `from`/`to` take precedence over `since`/`until` when both
//    spellings are supplied (historical alias behavior).
//  - A date-only string (`YYYY-MM-DD`) is a calendar day in `DATE_WINDOW_TIMEZONE`
//    (UTC): the lower bound becomes the START of that day, and the upper bound
//    becomes the START OF THE FOLLOWING day (so the selected `to` day is fully
//    captured). This is the exclusive start-of-next-day boundary.
//  - Any other value is an EXACT INSTANT: an ISO-8601 timestamp (with a time
//    component and optional offset), an epoch-ms number, or an all-digit
//    epoch-ms string. These are compared as-is.
//  - An inverted range (`from` > `to`) or an unparseable date is rejected.
// ============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Timezone in which date-only calendar days are expanded. Pinned to UTC so the
 * boundary is deterministic regardless of the host's local timezone or DST —
 * `2026-07-15` always means `[2026-07-15T00:00:00Z, 2026-07-16T00:00:00Z)`.
 */
export const DATE_WINDOW_TIMEZONE = 'UTC';

export interface DateWindow {
  since?: number;
  until?: number;
}

export type DateWindowResult =
  | { ok: true; window: DateWindow }
  | { ok: false; error: string };

interface ParsedBound {
  ms: number;
  kind: 'date' | 'instant';
}

function parseBound(v: string | number): ParsedBound | null {
  if (typeof v === 'number') {
    return Number.isFinite(v) ? { ms: v, kind: 'instant' } : null;
  }
  const s = v.trim();
  if (s === '') return null;
  // Date-only → calendar day in DATE_WINDOW_TIMEZONE (UTC). A date-only ISO
  // string parses to UTC midnight per the ES spec, so `start` is already the
  // start of the day in UTC.
  if (DATE_ONLY_RE.test(s)) {
    const start = Date.parse(s);
    if (!Number.isFinite(start)) return null;
    return { ms: start, kind: 'date' };
  }
  // All-digits string → epoch-ms (exact instant), mirroring the original parser.
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? { ms: n, kind: 'instant' } : null;
  }
  // ISO-8601 (or anything else Date.parse accepts) → exact instant.
  const t = Date.parse(s);
  return Number.isFinite(t) ? { ms: t, kind: 'instant' } : null;
}

/**
 * Parse a backfill date window. `from`/`to` win over `since`/`until`. Date-only
 * bounds are expanded to calendar-day boundaries in UTC; everything else is an
 * exact instant. Rejects inverted ranges and unparseable dates.
 */
export function parseDateWindow(input: {
  from?: string | number;
  since?: string | number;
  to?: string | number;
  until?: string | number;
}): DateWindowResult {
  const lowerRaw = input.from ?? input.since;
  const upperRaw = input.to ?? input.until;

  let lower: ParsedBound | undefined;
  let upper: ParsedBound | undefined;

  if (lowerRaw !== undefined) {
    const parsed = parseBound(lowerRaw);
    if (!parsed) return { ok: false, error: 'Invalid "from" date' };
    lower = parsed;
  }
  if (upperRaw !== undefined) {
    const parsed = parseBound(upperRaw);
    if (!parsed) return { ok: false, error: 'Invalid "to" date' };
    upper = parsed;
  }

  // Reject inverted ranges on the raw anchors (before date-only expansion). A
  // date-only upper bound rolls forward a full day, so comparing the EXPANDED
  // bounds would miss a one-day inversion (from = day after to collapses to
  // equal and slip through). Comparing anchors also keeps mixed date/instant
  // bounds correct: a date-only bound's anchor is its UTC start-of-day ms, an
  // instant's anchor is itself.
  if (lower !== undefined && upper !== undefined && lower.ms > upper.ms) {
    return { ok: false, error: '"from" date is later than "to" date' };
  }

  const since = lower?.ms;
  // Exclusive upper bound: a date-only `to` covers the whole selected day, so
  // it rolls forward to the start of the next day (UTC). Exact instants stay.
  const until =
    upper === undefined ? undefined : upper.kind === 'date' ? upper.ms + MS_PER_DAY : upper.ms;

  const window: DateWindow = {};
  if (since !== undefined) window.since = since;
  if (until !== undefined) window.until = until;
  return { ok: true, window };
}
