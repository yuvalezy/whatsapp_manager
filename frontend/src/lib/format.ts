// ============================================================================
// Formatting helpers — phone numbers, relative time, initials.
// Pure functions, no side effects; safe to use anywhere.
// ============================================================================

/**
 * Format a WhatsApp-style number (digits, optionally with @c.us) for display.
 * Keeps it simple and locale-agnostic: `+CC XXX XXX XXXX`-ish grouping.
 * Falls back to a `+`-prefixed digit string when the shape is unknown.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.split('@')[0].replace(/\D/g, '');
  if (!digits) return raw;

  // North America: +1 (AAA) BBB CCCC
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  // Generic: split country-ish prefix then group the rest in 3s from the right.
  const cc = digits.slice(0, digits.length > 11 ? 3 : 2);
  const rest = digits.slice(cc.length);
  const grouped = rest.replace(/(\d)(?=(\d{3})+$)/g, '$1 ');
  return `+${cc} ${grouped}`.trim();
}

/** Normalize any human-entered number to digits only (mirrors the backend). */
export function normalizeNumber(raw: string): string {
  return raw.split('@')[0].replace(/\D/g, '');
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
];

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "4 minutes ago", "just now", "2 days ago" from an ISO timestamp or Date. */
export function relativeTime(input: string | number | Date | null | undefined): string {
  if (input == null) return '';
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return '';
  const diffSeconds = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 10) return 'just now';
  for (const [unit, secs] of RELATIVE_UNITS) {
    if (abs >= secs || unit === 'second') {
      return rtf.format(Math.round(diffSeconds / secs), unit);
    }
  }
  return 'just now';
}

/** Absolute, human-readable date-time (for tooltips / detail views). */
export function formatDateTime(input: string | number | Date | null | undefined): string {
  if (input == null) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Up to two uppercase initials from a display name. */
export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** USD amount, e.g. `$3.42`. Use `precise` for small per-call amounts (6dp, matching the DB's NUMERIC(10,6)). */
export function formatUsd(amount: number | null | undefined, precise = false): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: precise ? 6 : 2,
    maximumFractionDigits: precise ? 6 : 2,
  }).format(value);
}

/** Local calendar-day key (`YYYY-MM-DD`) for grouping messages into day buckets. */
export function dayKey(input: string | number | Date | null | undefined): string {
  const d = input == null ? new Date(NaN) : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Divider label for a message's day: "Today", "Yesterday", or an absolute date. */
export function dayDividerLabel(input: string | number | Date | null | undefined): string {
  if (input == null) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** Deterministic hue (0–359) derived from a string — used for avatar tints. */
export function hueFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}
