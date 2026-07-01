import { cn } from '@/lib/cn';
import { initials as toInitials } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

// ============================================================================
// Avatar — initials chip with a deterministic tint derived from the name.
// Ported from Avatar.dc.html (fixed 6-hue palette hashed by name).
// ============================================================================

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  personName?: string;
  size?: AvatarSize;
  className?: string;
}

const HUES = ['#25D366', '#4FA3D1', '#F5A623', '#B084F0', '#F2555A', '#3FC7C7'];
const BOX: Record<AvatarSize, number> = { sm: 26, md: 34, lg: 44 };

function hashHue(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

export function Avatar({ personName = '?', size = 'md', className }: AvatarProps) {
  const { isLight } = useTheme();
  const box = BOX[size];
  const hue = hashHue(personName);
  return (
    <span
      className={cn('inline-flex flex-shrink-0 items-center justify-center rounded-full border font-bold', className)}
      style={{
        width: box,
        height: box,
        fontSize: box * 0.38,
        background: hue + (isLight ? '26' : '33'),
        color: hue,
        borderColor: hue + '55',
      }}
    >
      {toInitials(personName)}
    </span>
  );
}
