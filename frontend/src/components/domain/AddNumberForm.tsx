import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/Select';
import type { Gender } from '@/types';

const GENDER_OPTIONS: SelectOption[] = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

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
  onAdd?: (payload: { number: string; label?: string; gender?: Gender }) => void;
  className?: string;
}

export function AddNumberForm({ submitting = false, onAdd, className }: AddNumberFormProps) {
  const [number, setNumber] = useState('');
  const [label, setLabel] = useState('');
  const [gender, setGender] = useState<Gender>('unknown');
  const [touched, setTouched] = useState(false);
  const error = touched ? validate(number) : '';

  const handleSubmit = () => {
    setTouched(true);
    if (validate(number)) return;
    onAdd?.({ number, label: label || undefined, gender });
    setNumber('');
    setLabel('');
    setGender('unknown');
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
        <div className="w-[150px]">
          <Select
            label="Gender"
            value={gender}
            options={GENDER_OPTIONS}
            onChange={(v) => setGender(v as Gender)}
          />
        </div>
        <div className="pt-[22px]">
          <Button label="Add number" variant="primary" icon="plus" loading={submitting} onClick={handleSubmit} />
        </div>
      </div>
    </div>
  );
}
