import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { SummarizeInput } from '@/types';

// ============================================================================
// SummarizeModal — pick a window (amount + minutes/hours) and generate an AI
// summary of the most recent activity in the open conversation.
// ============================================================================

export interface SummarizeModalProps {
  open: boolean;
  submitting?: boolean;
  error?: string | null;
  onClose?: () => void;
  onSubmit?: (input: SummarizeInput) => void;
}

const UNIT_OPTIONS = [
  { value: 'minutes', label: 'minutes' },
  { value: 'hours', label: 'hours' },
];

export function SummarizeModal({ open, submitting = false, error, onClose, onSubmit }: SummarizeModalProps) {
  const [amount, setAmount] = useState('30');
  const [unit, setUnit] = useState<'minutes' | 'hours'>('minutes');

  useEffect(() => {
    if (open) {
      setAmount('30');
      setUnit('minutes');
    }
  }, [open]);

  const parsed = Math.max(1, Math.round(Number(amount) || 0));
  const valid = Number(amount) >= 1;

  const submit = () => {
    if (!valid) return;
    onSubmit?.({ amount: parsed, unit });
  };

  return (
    <Modal
      open={open}
      title="Summarize conversation"
      description="Generate an AI summary of the most recent activity. Any images in the window are analyzed too."
      size="sm"
      primaryLabel="Summarize"
      primaryDisabled={!valid}
      loading={submitting}
      onPrimary={submit}
      onSecondary={onClose}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        {error && (
          <div className="rounded-wm-sm border border-danger/40 bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        <div className="flex items-end gap-3">
          <Input label="Last" type="number" value={amount} onChange={setAmount} className="w-[110px]" />
          <Select
            label="Unit"
            value={unit}
            options={UNIT_OPTIONS}
            onChange={(v) => setUnit(v === 'hours' ? 'hours' : 'minutes')}
            className="w-[150px]"
          />
        </div>
        <span className="text-xs text-fg-muted">
          Summarizes the last {parsed} {unit} leading up to the most recent message.
        </span>
      </div>
    </Modal>
  );
}
