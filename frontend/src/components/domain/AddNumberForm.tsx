import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

// ============================================================================
// AddNumberForm — number + optional label + submit, with lightweight inline
// validation. Ported from AddNumberForm.dc.html. Presentational: the page wires
// `onAdd` (e.g. to the add-whitelist mutation) and `submitting`.
// ============================================================================

function validate(v: string): string {
  const cleaned = (v || '').replace(/[^\d+]/g, '');
  if (!cleaned) return 'Phone number is required';
  if (cleaned.replace('+', '').length < 8) return 'Enter a full number with country code';
  return '';
}

export interface AddNumberFormProps {
  submitting?: boolean;
  onAdd?: (payload: { number: string; label?: string }) => void;
  className?: string;
}

export function AddNumberForm({ submitting = false, onAdd, className }: AddNumberFormProps) {
  const [number, setNumber] = useState('');
  const [label, setLabel] = useState('');
  const [touched, setTouched] = useState(false);
  const error = touched ? validate(number) : '';

  const handleSubmit = () => {
    setTouched(true);
    if (validate(number)) return;
    onAdd?.({ number, label: label || undefined });
    setNumber('');
    setLabel('');
    setTouched(false);
  };

  return (
    <div className={cn('font-sans', className)}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-[230px]">
          <Input
            label="Phone number"
            placeholder="+1 415 555 0132"
            value={number}
            mono
            type="tel"
            required
            error={error || undefined}
            onChange={setNumber}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>
        <div className="w-[220px]">
          <Input
            label="Label (optional)"
            placeholder="e.g. Mom, Alex (work)"
            value={label}
            onChange={setLabel}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>
        <div className="pt-[22px]">
          <Button label="Add number" variant="primary" icon="plus" loading={submitting} onClick={handleSubmit} />
        </div>
      </div>
    </div>
  );
}
