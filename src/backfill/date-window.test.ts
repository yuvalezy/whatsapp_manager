import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDateWindow, DATE_WINDOW_TIMEZONE } from './date-window';

// ============================================================================
// parseDateWindow — focused coverage for the backfill date-window rules.
//
// Invariants under test (see date-window.ts):
//  - `from`/`to` win over the `since`/`until` aliases.
//  - A date-only `YYYY-MM-DD` lower bound = start of that day (inclusive); a
//    date-only upper bound = START OF THE NEXT DAY (exclusive), so the selected
//    `to` day is captured in full. Calendar day is in DATE_WINDOW_TIMEZONE.
//  - Epoch-ms numbers, all-digit epoch-ms strings, and ISO-8601 timestamps are
//    treated as EXACT INSTANTS (not expanded to a day).
//  - Inverted ranges and unparseable dates are rejected.
// ============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Deterministic UTC anchors (date-only ISO parses to UTC midnight per ES spec).
const DAY_2026_07_15 = Date.parse('2026-07-15'); // 2026-07-15T00:00:00Z
const DAY_2026_07_16 = Date.parse('2026-07-16');
const DAY_2026_07_10 = Date.parse('2026-07-10');

function ok(input: Parameters<typeof parseDateWindow>[0]) {
  const r = parseDateWindow(input);
  assert.equal(r.ok, true, `expected ok for ${JSON.stringify(input)}, got error`);
  return (r as { ok: true; window: { since?: number; until?: number } }).window;
}

function err(input: Parameters<typeof parseDateWindow>[0]): string {
  const r = parseDateWindow(input);
  assert.equal(r.ok, false, `expected error for ${JSON.stringify(input)}, got ok`);
  return (r as { ok: false; error: string }).error;
}

describe('parseDateWindow: empty / single bounds', () => {
  it('returns an empty window when nothing is supplied', () => {
    assert.deepEqual(ok({}), {});
  });

  it('accepts a lower bound only', () => {
    assert.deepEqual(ok({ from: '2026-07-15' }), { since: DAY_2026_07_15 });
  });

  it('accepts an upper bound only', () => {
    // date-only upper bound rolls forward to start of next day (exclusive)
    assert.deepEqual(ok({ to: '2026-07-15' }), { until: DAY_2026_07_16 });
  });
});

describe('parseDateWindow: date-only calendar-day expansion (#6)', () => {
  it('treats a date-only `to` as exclusive start-of-next-day in UTC', () => {
    const w = ok({ to: '2026-07-15' });
    assert.equal(w.until, DAY_2026_07_16);
    assert.equal(w.until! - DAY_2026_07_15, MS_PER_DAY);
  });

  it('captures a full selected day with from=to same date', () => {
    // from = start of 07-15 (inclusive), until = start of 07-16 (exclusive)
    const w = ok({ from: '2026-07-15', to: '2026-07-15' });
    assert.equal(w.since, DAY_2026_07_15);
    assert.equal(w.until, DAY_2026_07_16);
    assert.ok(w.until! > w.since!, 'same-day window must be a positive range');
  });

  it('expands both bounds as calendar days in the documented timezone', () => {
    const w = ok({ from: '2026-07-10', to: '2026-07-15' });
    assert.equal(w.since, DAY_2026_07_10);
    assert.equal(w.until, DAY_2026_07_16);
  });

  it('documents the timezone as UTC', () => {
    assert.equal(DATE_WINDOW_TIMEZONE, 'UTC');
  });
});

describe('parseDateWindow: exact-instant inputs', () => {
  it('treats an epoch-ms number as an exact instant (not a calendar day)', () => {
    const inst = Date.parse('2026-07-15T13:30:00Z');
    const w = ok({ to: inst });
    // NOT expanded — the instant is returned as-is
    assert.equal(w.until, inst);
    assert.notEqual(w.until, DAY_2026_07_16);
  });

  it('treats an all-digit string as epoch-ms (exact instant)', () => {
    const inst = Date.parse('2026-07-15T13:30:00Z');
    const w = ok({ from: String(inst), to: String(inst + 60_000) });
    assert.equal(w.since, inst);
    assert.equal(w.until, inst + 60_000);
  });

  it('treats an ISO-8601 timestamp with time as an exact instant', () => {
    const w = ok({ from: '2026-07-15T13:30:00Z' });
    assert.equal(w.since, Date.parse('2026-07-15T13:30:00Z'));
    // a midday instant is NOT rolled to midnight
    assert.notEqual(w.since, DAY_2026_07_15);
  });

  it('mixes a date-only lower bound with a timestamp upper bound', () => {
    const w = ok({ from: '2026-07-15', to: '2026-07-15T23:59:59Z' });
    assert.equal(w.since, DAY_2026_07_15);
    assert.equal(w.until, Date.parse('2026-07-15T23:59:59Z'));
  });
});

describe('parseDateWindow: alias precedence', () => {
  it('prefers `from` over `since`', () => {
    const w = ok({ from: '2026-07-15', since: '2026-07-10' });
    assert.equal(w.since, DAY_2026_07_15);
  });

  it('prefers `to` over `until`', () => {
    const w = ok({ to: '2026-07-15', until: '2026-07-20' });
    assert.equal(w.until, DAY_2026_07_16);
  });

  it('falls back to `since`/`until` when `from`/`to` absent', () => {
    const w = ok({ since: '2026-07-10', until: '2026-07-15' });
    assert.equal(w.since, DAY_2026_07_10);
    assert.equal(w.until, DAY_2026_07_16);
  });
});

describe('parseDateWindow: inverted ranges (#5)', () => {
  it('rejects a date-only from later than date-only to', () => {
    assert.match(err({ from: '2026-07-16', to: '2026-07-15' }), /later than/i);
  });

  it('rejects timestamp instants where from > to', () => {
    const a = Date.parse('2026-07-15T10:00:00Z');
    const b = Date.parse('2026-07-15T09:00:00Z');
    assert.match(err({ from: a, to: b }), /later than/i);
  });

  it('rejects an inverted date-only from against a timestamp to', () => {
    // from = 2026-07-16T00:00Z, to = 2026-07-15T23:00Z (earlier) → inverted
    assert.match(err({ from: '2026-07-16', to: '2026-07-15T23:00:00Z' }), /later than/i);
  });

  it('accepts equal instants (from === to is not inverted)', () => {
    const inst = Date.parse('2026-07-15T10:00:00Z');
    const w = ok({ from: inst, to: inst });
    assert.equal(w.since, inst);
    assert.equal(w.until, inst);
  });
});

describe('parseDateWindow: invalid dates', () => {
  it('rejects an unparseable from', () => {
    assert.match(err({ from: 'not-a-date' }), /invalid "from"/i);
  });

  it('rejects an unparseable to', () => {
    assert.match(err({ to: '2026-13-45' }), /invalid "to"/i);
  });

  it('rejects NaN epoch numbers', () => {
    // NaN is not finite → treated as invalid
    assert.match(err({ from: Number.NaN }), /invalid "from"/i);
  });
});

describe('parseDateWindow: regression — original bug #6', () => {
  it('a date-only `to` no longer excludes almost the entire selected day', () => {
    // Before the fix, `to: '2026-07-15'` parsed to 2026-07-15T00:00:00Z, so an
    // afternoon message (13:00) would be EXCLUDED. After the fix, the exclusive
    // boundary is the start of the next day, so 13:00 is captured.
    const w = ok({ to: '2026-07-15' });
    const afternoon = Date.parse('2026-07-15T13:00:00Z');
    assert.ok(afternoon < w.until!, 'afternoon message must be inside the window');
    assert.ok(
      Date.parse('2026-07-16T00:00:00Z') === w.until,
      'boundary is exactly the start of the next day',
    );
  });
});
