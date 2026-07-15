import { useEffect, useRef, type RefObject } from 'react';

// ============================================================================
// useFocusTrap — dependency-free focus management for modal overlays.
// While `active`, it: (1) remembers the previously-focused element, (2) moves
// focus into the overlay, (3) keeps Tab/Shift+Tab cycling within the overlay's
// focusable elements, (4) forwards Escape to `onEscape`, and (5) restores
// focus to the trigger on deactivation. The container must be focusable
// (give it `tabIndex={-1}`) so it can receive the initial focus safely.
// ============================================================================

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface UseFocusTrapOptions {
  containerRef: RefObject<HTMLElement | null>;
  active: boolean;
  /** Element to focus when the trap activates (defaults to the container). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Called on Escape. Held in a ref so callback churn can't reset the trap. */
  onEscape?: () => void;
}

function visibleFocusable(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((el) => {
    if (el.getAttribute('aria-hidden') === 'true') return false;
    // getClientRects() is empty for display:none — skips unrendered branches.
    return el.getClientRects().length > 0;
  });
}

export function useFocusTrap({ containerRef, active, initialFocusRef, onEscape }: UseFocusTrapOptions) {
  // Keep the escape callback in a ref so the effect below only re-runs when
  // `active` flips — otherwise a new callback identity mid-open would reset
  // `previouslyFocused` to the overlay itself and break focus restoration.
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the overlay. Prefer an explicit target; otherwise the
    // container (which carries tabIndex={-1}).
    const target = initialFocusRef?.current ?? container;
    target.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        escapeRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = visibleFocusable(container);
      if (focusable.length === 0) {
        e.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (current === last || !container.contains(current)) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
    // Deliberately only re-run on `active` toggles; refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
