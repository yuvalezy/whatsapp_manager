import { Badge } from '@/components/ui/Badge';
import type { IconName } from '@/components/ui/Icon';
import type { Tone } from '@/lib/tones';
import type { MessageType } from '@/types';

// ============================================================================
// MessageTypeBadge — maps a WhatsApp message type to a labeled tone badge.
// Ported from MessageTypeBadge.dc.html.
// ============================================================================

interface TypeMeta {
  label: string;
  tone: Tone;
  icon?: IconName;
}

const MAP: Record<string, TypeMeta> = {
  chat: { label: 'Text', tone: 'neutral' },
  image: { label: 'Image', tone: 'info', icon: 'image' },
  video: { label: 'Video', tone: 'info', icon: 'video' },
  audio: { label: 'Audio', tone: 'info', icon: 'mic' },
  ptt: { label: 'Voice note', tone: 'info', icon: 'mic' },
  document: { label: 'Document', tone: 'neutral', icon: 'fileText' },
  sticker: { label: 'Sticker', tone: 'neutral', icon: 'sticker' },
  location: { label: 'Location', tone: 'warning', icon: 'mapPin' },
  vcard: { label: 'Contact', tone: 'neutral', icon: 'contact' },
};

export interface MessageTypeBadgeProps {
  messageType: MessageType;
  className?: string;
}

export function MessageTypeBadge({ messageType, className }: MessageTypeBadgeProps) {
  const meta = MAP[messageType] ?? MAP.chat;
  return <Badge label={meta.label} tone={meta.tone} icon={meta.icon} className={className} />;
}
