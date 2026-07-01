import { cn } from '@/lib/cn';

// ============================================================================
// Skeleton — shimmering placeholder block. Ported from Skeleton.dc.html.
// The shimmer gradient is theme-aware via CSS variables set below.
// ============================================================================

export interface SkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
  className?: string;
}

export function Skeleton({ width = '100%', height = '14px', radius = '6px', className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-wm-skeleton bg-[length:400px_100%]', className)}
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundImage:
          'linear-gradient(90deg, var(--wm-skeleton-base) 0%, var(--wm-skeleton-sheen) 50%, var(--wm-skeleton-base) 100%)',
      }}
    />
  );
}
