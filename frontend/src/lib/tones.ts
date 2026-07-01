// ============================================================================
// Semantic tone → Tailwind class maps. Single source of truth shared by Badge,
// StatusPill, Toast, and any other tone-driven component. Each tone resolves to
// the design's exact [bg, fg, border] triple via CSS-variable-backed classes.
// ============================================================================

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/** Soft-filled treatment: soft background + on-soft text + soft border. */
export const TONE_SOFT: Record<Tone, string> = {
  neutral: 'bg-neutral-soft text-neutral-fg border-neutral-line',
  success: 'bg-success-soft text-success-fg border-success-line',
  warning: 'bg-warning-soft text-warning-fg border-warning-line',
  danger: 'bg-danger-soft text-danger-fg border-danger-line',
  info: 'bg-info-soft text-info-fg border-info-line',
};

/** Just the on-soft text color (for the leading dot / icon inside a soft chip). */
export const TONE_FG: Record<Tone, string> = {
  neutral: 'text-neutral-fg',
  success: 'text-success-fg',
  warning: 'text-warning-fg',
  danger: 'text-danger-fg',
  info: 'text-info-fg',
};

/** Dot/indicator background using the on-soft text color. */
export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-neutral-fg',
  success: 'bg-success-fg',
  warning: 'bg-warning-fg',
  danger: 'bg-danger-fg',
  info: 'bg-info-fg',
};
