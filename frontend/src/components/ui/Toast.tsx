import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

// ============================================================================
// Toast — a single notification card (tone success/warning/danger/info) with a
// colored left accent. Ported from Toast.dc.html. A lightweight ToastProvider +
// useToast() manage a fixed-corner stack for the host app.
// ============================================================================

export type ToastTone = 'success' | 'warning' | 'danger' | 'info';

const TONE_ICON: Record<ToastTone, IconName> = {
  success: 'check',
  warning: 'alertTriangle',
  danger: 'alertCircle',
  info: 'shield',
};

const TONE_ACCENT: Record<ToastTone, string> = {
  success: 'text-success-fg',
  warning: 'text-warning-fg',
  danger: 'text-danger-fg',
  info: 'text-info-fg',
};

const TONE_BORDER: Record<ToastTone, string> = {
  success: 'border-l-success-fg',
  warning: 'border-l-warning-fg',
  danger: 'border-l-danger-fg',
  info: 'border-l-info-fg',
};

export interface ToastProps {
  tone?: ToastTone;
  title: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
  className?: string;
}

export function Toast({ tone = 'info', title, description, onClose, className }: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex w-[320px] max-w-[calc(100vw-32px)] items-start gap-2.5 rounded-[12px] border border-l-[3px] border-line-strong bg-surface py-3 pl-[14px] pr-3 shadow-wm-pop',
        TONE_BORDER[tone],
        className,
      )}
    >
      <span className={cn('mt-0.5 flex flex-shrink-0', TONE_ACCENT[tone])}>
        <Icon name={TONE_ICON[tone]} size={16} />
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="text-[13.5px] font-bold text-fg">{title}</div>
        {description != null && (
          <div className="text-[12.5px] leading-snug text-fg-secondary">{description}</div>
        )}
      </div>
      {onClose && (
        <IconButton icon="x" size="sm" variant="ghost" ariaLabel="Dismiss" onClick={onClose} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider / hook
// ---------------------------------------------------------------------------

interface ToastItem extends Omit<ToastProps, 'onClose'> {
  id: number;
}

interface ToastContextValue {
  toast: (t: Omit<ToastProps, 'onClose'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const AUTO_DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((t: Omit<ToastProps, 'onClose'>) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { ...t, id }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-5 right-5 z-[1100] flex flex-col gap-2.5">
          {items.map((t) => (
            <div key={t.id} className="pointer-events-auto animate-wm-scale-in">
              <AutoToast {...t} onClose={() => dismiss(t.id)} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

function AutoToast({ id: _id, onClose, ...rest }: ToastItem & { onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onClose]);
  return <Toast {...rest} onClose={onClose} />;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
