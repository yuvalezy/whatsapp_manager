import { useEffect, useRef, useState } from 'react';
import type { DailyVolume } from '@/types';

// ============================================================================
// MessageVolumeChart — inbound vs outbound message volume over time, drawn as
// grouped bars in hand-built SVG (no charting lib). Two categorical series in
// fixed order: received = info (blue), sent = primary (green) — a CVD-safe
// pair. Identity is never color-alone: a legend is always shown, every bar
// carries a hover <title>, and an sr-only table mirrors the data. Marks use the
// design tokens (fill = CSS var) so it reads in light and dark automatically.
// ============================================================================

const SERIES = {
  inbound: { label: 'Received', color: 'var(--wm-info)', swatch: 'bg-info' },
  outbound: { label: 'Sent', color: 'var(--wm-primary)', swatch: 'bg-primary' },
} as const;

const HEIGHT = 240;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 28;
const MIN_GROUP = 26; // min px per day; wider content scrolls horizontally

export interface MessageVolumeChartProps {
  data: DailyVolume[];
}

export function MessageVolumeChart({ data }: MessageVolumeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.inbound, d.outbound)));
  const { top, ticks } = chooseTicks(maxVal);

  const chartW = Math.max(width, data.length * MIN_GROUP + PAD_L + PAD_R);
  const plotW = chartW - PAD_L - PAD_R;
  const plotH = HEIGHT - PAD_T - PAD_B;
  const baseline = PAD_T + plotH;
  const groupW = data.length > 0 ? plotW / data.length : plotW;
  const barW = clamp(groupW / 2 - 3, 4, 16);
  const pairW = barW * 2 + 2;
  const yFor = (v: number) => baseline - (v / top) * plotH;
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  const totalIn = data.reduce((s, d) => s + d.inbound, 0);
  const totalOut = data.reduce((s, d) => s + d.outbound, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {(Object.keys(SERIES) as (keyof typeof SERIES)[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-[12px] text-fg-secondary">
            <span className={`h-2.5 w-2.5 rounded-[3px] ${SERIES[k].swatch}`} aria-hidden="true" />
            {SERIES[k].label}
          </span>
        ))}
      </div>

      <div ref={containerRef} className="w-full overflow-x-auto">
        {width > 0 && (
          <svg
            width={chartW}
            height={HEIGHT}
            role="img"
            aria-label={`Message volume over ${data.length} days: ${totalIn} received, ${totalOut} sent.`}
            className="block"
          >
            {/* Gridlines + y labels */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD_L}
                  y1={yFor(t)}
                  x2={chartW - PAD_R}
                  y2={yFor(t)}
                  stroke="var(--wm-line)"
                  strokeWidth={1}
                />
                <text
                  x={PAD_L - 6}
                  y={yFor(t) + 3.5}
                  textAnchor="end"
                  fontSize={10.5}
                  fill="var(--wm-fg-muted)"
                >
                  {t}
                </text>
              </g>
            ))}

            {/* Bars */}
            {data.map((d, i) => {
              const cx = PAD_L + groupW * i + groupW / 2;
              const inX = cx - pairW / 2;
              const outX = inX + barW + 2;
              const showLabel = i % labelStep === 0 || i === data.length - 1;
              const dayLabel = new Date(d.date).toLocaleDateString(undefined, {
                month: 'numeric',
                day: 'numeric',
              });
              return (
                <g key={d.date}>
                  {d.inbound > 0 && (
                    <path d={topRoundedBar(inX, yFor(d.inbound), barW, baseline - yFor(d.inbound))} fill={SERIES.inbound.color}>
                      <title>{`${dayLabel}: ${d.inbound} received`}</title>
                    </path>
                  )}
                  {d.outbound > 0 && (
                    <path d={topRoundedBar(outX, yFor(d.outbound), barW, baseline - yFor(d.outbound))} fill={SERIES.outbound.color}>
                      <title>{`${dayLabel}: ${d.outbound} sent`}</title>
                    </path>
                  )}
                  {showLabel && (
                    <text x={cx} y={baseline + 16} textAnchor="middle" fontSize={10.5} fill="var(--wm-fg-muted)">
                      {dayLabel}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Baseline */}
            <line x1={PAD_L} y1={baseline} x2={chartW - PAD_R} y2={baseline} stroke="var(--wm-line-strong)" strokeWidth={1} />
          </svg>
        )}
      </div>

      {/* Text alternative for screen readers. */}
      <table className="sr-only">
        <caption>Message volume per day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Received</th>
            <th>Sent</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.inbound}</td>
              <td>{d.outbound}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Top-rounded bar path anchored to the baseline (rounded data-end, flat foot). */
function topRoundedBar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

/** A "nice" axis top + integer-stepped gridline values (~4 ticks). */
function chooseTicks(maxVal: number): { top: number; ticks: number[] } {
  const nice = niceMax(maxVal);
  const step = Math.max(1, Math.round(nice / 4));
  const top = Math.ceil(nice / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

function niceMax(v: number): number {
  if (v <= 5) return Math.max(1, Math.ceil(v));
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const s = n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return s * pow;
}
