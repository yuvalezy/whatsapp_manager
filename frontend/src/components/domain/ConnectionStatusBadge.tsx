import { StatusPill } from '@/components/ui/StatusPill';
import type { Tone } from '@/lib/tones';
import type { ConnectionState } from '@/types';

// ============================================================================
// ConnectionStatusBadge — maps a WhatsApp connection state to a status pill.
// Ported from ConnectionStatusBadge.dc.html.
// ============================================================================

interface StateMeta {
  label: string;
  tone: Tone;
  pulse: boolean;
}

const MAP: Record<ConnectionState, StateMeta> = {
  INITIALIZING: { label: 'Initializing…', tone: 'neutral', pulse: true },
  QR_READY: { label: 'Scan QR code', tone: 'info', pulse: true },
  AUTHENTICATED: { label: 'Linking device…', tone: 'warning', pulse: true },
  READY: { label: 'Connected', tone: 'success', pulse: false },
  DISCONNECTED: { label: 'Reconnecting…', tone: 'warning', pulse: true },
  AUTH_FAILURE: { label: 'Authentication failed', tone: 'danger', pulse: false },
  ERROR: { label: 'Connection error', tone: 'danger', pulse: false },
};

export interface ConnectionStatusBadgeProps {
  state: ConnectionState;
  label?: string;
  className?: string;
}

export function ConnectionStatusBadge({ state, label, className }: ConnectionStatusBadgeProps) {
  const meta = MAP[state] ?? MAP.READY;
  return <StatusPill label={label || meta.label} tone={meta.tone} pulse={meta.pulse} className={className} />;
}
