import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';
import { HighlightText } from './HighlightText';

// ============================================================================
// Combobox — searchable, grouped, keyboard-navigable single-select dropdown.
// A richer alternative to `Select` for long option lists: type to filter,
// options render under grouped section headers (Contacts / Groups / …), each
// section is sorted upstream by the caller. The popover is a portal anchored
// under (or above) the trigger; closes on outside-click / Escape; arrow keys
// move the active option, Enter selects. Controlled via `onChange(value)`.
// Every option must carry a non-empty, unique `value`.
// ============================================================================

export interface ComboboxOption {
  value: string;
  label: string;
  /** Secondary muted text shown under the label (e.g. a phone number). */
  hint?: string;
  /** Leading glyph; falls back to nothing. */
  icon?: IconName;
}

export interface ComboboxSection {
  /** Section header (also doubles as an optgroup label). */
  label: string;
  options: ComboboxOption[];
}

export interface ComboboxProps {
  label?: ReactNode;
  value?: string;
  sections: ComboboxSection[];
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: string;
  /** Trigger placeholder when no value is selected. */
  placeholder?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

type PanelPos =
  | { side: 'below'; top: number; left: number; width: number; maxHeight: number }
  | { side: 'above'; bottom: number; left: number; width: number; maxHeight: number };

export function Combobox({
  label,
  value,
  sections,
  onChange,
  disabled = false,
  error,
  placeholder = 'Select…',
  className,
  id,
  'aria-label': ariaLabel,
}: ComboboxProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [pos, setPos] = useState<PanelPos | null>(null);

  const hasError = !!error;

  const setOptionRef = useCallback(
    (val: string) => (el: HTMLElement | null) => {
      if (el) optionRefs.current.set(val, el);
      else optionRefs.current.delete(val);
    },
    [],
  );

  const lookup = useMemo(() => {
    const map = new Map<string, ComboboxOption>();
    for (const s of sections) for (const o of s.options) map.set(o.value, o);
    return map;
  }, [sections]);

  const selected = value != null ? lookup.get(value) : undefined;

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        options: s.options.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            o.value.toLowerCase().includes(q) ||
            (o.hint?.toLowerCase().includes(q) ?? false),
        ),
      }))
      .filter((s) => s.options.length > 0);
  }, [sections, query]);

  const flatOptions = useMemo(
    () => filteredSections.flatMap((s) => s.options),
    [filteredSections],
  );

  // Keep the active (keyboard-focused) option valid as the list filters.
  useEffect(() => {
    if (flatOptions.length === 0) {
      setActiveValue(null);
      return;
    }
    const stillThere = activeValue != null && flatOptions.some((o) => o.value === activeValue);
    if (stillThere) return;
    setActiveValue(flatOptions.some((o) => o.value === value) ? (value as string) : flatOptions[0].value);
  }, [flatOptions, activeValue, value]);

  // Scroll the active option into view while navigating / filtering.
  useEffect(() => {
    if (!open || activeValue == null) return;
    optionRefs.current.get(activeValue)?.scrollIntoView({ block: 'nearest' });
  }, [activeValue, open, query]);

  const place = useCallback(() => {
    const trig = triggerRef.current;
    if (!trig) return;
    const r = trig.getBoundingClientRect();
    const margin = 6;
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;
    if (spaceBelow >= 220 || spaceBelow >= spaceAbove) {
      setPos({
        side: 'below',
        top: r.bottom + margin,
        left: r.left,
        width: r.width,
        maxHeight: Math.max(180, Math.min(380, spaceBelow)),
      });
    } else {
      setPos({
        side: 'above',
        bottom: window.innerHeight - r.top + margin,
        left: r.left,
        width: r.width,
        maxHeight: Math.max(180, Math.min(380, spaceAbove)),
      });
    }
  }, []);

  // Reposition on open and while open (scroll/resize).
  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, place]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus the search box on open.
  useLayoutEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setActiveValue(value ?? null);
  };

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }, []);

  const select = (val: string) => {
    onChange?.(val);
    close();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (flatOptions.length === 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
      return;
    }
    const i = flatOptions.findIndex((o) => o.value === activeValue);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = flatOptions[Math.min(i + 1, flatOptions.length - 1)];
      if (next) setActiveValue(next.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = flatOptions[Math.max(i - 1, 0)];
      if (prev) setActiveValue(prev.value);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeValue != null) select(activeValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  const panelStyle = pos
    ? pos.side === 'above'
      ? { position: 'fixed' as const, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }
      : { position: 'fixed' as const, top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }
    : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label != null && (
        <label htmlFor={id} className="text-[12.5px] font-semibold text-fg-secondary">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openMenu())}
        className={cn(
          'relative w-full rounded-wm-sm border bg-surface text-left text-[13.5px] text-fg outline-none transition-[border-color,box-shadow] duration-150',
          selected?.icon ? 'py-[9px] pl-[34px] pr-8' : 'py-[9px] pl-3 pr-8',
          hasError ? 'border-danger' : 'border-line-strong',
          'focus:border-primary focus:shadow-[0_0_0_3px_var(--wm-primary-soft)]',
          disabled ? 'cursor-not-allowed bg-surface-2 opacity-60' : 'cursor-pointer hover:border-line',
        )}
      >
        {selected?.icon && (
          <span className="pointer-events-none absolute left-[11px] top-1/2 flex -translate-y-1/2 text-fg-muted">
            <Icon name={selected.icon} size={15} />
          </span>
        )}
        {selected ? (
          <span className="block truncate">{selected.label}</span>
        ) : (
          <span className="block truncate text-fg-muted">{placeholder}</span>
        )}
        <span className="pointer-events-none absolute right-[11px] top-1/2 flex -translate-y-1/2 text-fg-muted">
          <Icon name="chevronDown" size={14} />
        </span>
      </button>

      {hasError && <span className="text-xs text-danger">{error}</span>}

      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
          style={panelStyle}
          className="z-[1000] flex flex-col overflow-hidden rounded-wm border border-line-strong bg-surface shadow-wm-pop animate-wm-scale-in"
        >
          <div className="relative border-b border-line p-2">
            <span className="pointer-events-none absolute left-[15px] top-1/2 flex -translate-y-1/2 text-fg-muted">
              <Icon name="search" size={15} />
            </span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Search…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              className="w-full rounded-wm-sm border border-line-strong bg-surface-2 py-[7px] pl-[32px] pr-2.5 text-[13px] text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-muted focus:border-primary focus:shadow-[0_0_0_3px_var(--wm-primary-soft)]"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {flatOptions.length === 0 ? (
              <div className="px-3 py-5 text-center text-[13px] text-fg-muted">
                No matches for &ldquo;{query}&rdquo;.
              </div>
            ) : (
              filteredSections.map((section) => (
                <div key={section.label} role="group" aria-label={section.label}>
                  <div className="sticky top-0 z-[1] border-b border-line bg-surface-2 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-fg-muted">
                    {section.label}
                  </div>
                  {section.options.map((opt) => {
                    const isSelected = opt.value === value;
                    const isActive = opt.value === activeValue;
                    return (
                      <div
                        key={opt.value}
                        ref={setOptionRef(opt.value)}
                        role="option"
                        aria-selected={isSelected}
                        onMouseDown={(e) => {
                          // mousedown so it fires before the search input loses focus
                          e.preventDefault();
                          select(opt.value);
                        }}
                        onMouseMove={() => setActiveValue(opt.value)}
                        className={cn(
                          'flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left outline-none',
                          isActive ? 'bg-primary-soft' : 'hover:bg-surface-2',
                        )}
                      >
                        {opt.icon ? (
                          <span className="flex w-4 shrink-0 justify-center text-fg-muted">
                            <Icon name={opt.icon} size={15} />
                          </span>
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span
                            className={cn(
                              'truncate text-[13.5px]',
                              isSelected ? 'font-bold text-fg' : 'font-medium text-fg',
                            )}
                          >
                            <HighlightText text={opt.label} term={query} />
                          </span>
                          {opt.hint && (
                            <span className="truncate font-mono text-[11.5px] text-fg-muted">
                              <HighlightText text={opt.hint} term={query} />
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <span className="flex shrink-0 text-primary">
                            <Icon name="check" size={15} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
