import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';

// ============================================================================
// MessageFilters — search box + number filter + type filter. Ported from
// MessageFilters.dc.html. Fully controlled by the page.
// ============================================================================

export interface FilterNumber {
  phone_number: string;
  label?: string | null;
}

export interface MessageFiltersProps {
  search?: string;
  numberFilter?: string;
  typeFilter?: string;
  numbers?: FilterNumber[];
  onSearchChange?: (value: string) => void;
  onNumberChange?: (value: string) => void;
  onTypeChange?: (value: string) => void;
  className?: string;
}

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All types' },
  { value: 'chat', label: 'Text' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'ptt', label: 'Voice note' },
  { value: 'document', label: 'Document' },
  { value: 'sticker', label: 'Sticker' },
  { value: 'location', label: 'Location' },
  { value: 'vcard', label: 'Contact' },
];

export function MessageFilters({
  search = '',
  numberFilter = 'all',
  typeFilter = 'all',
  numbers = [],
  onSearchChange,
  onNumberChange,
  onTypeChange,
  className,
}: MessageFiltersProps) {
  const numberOptions: SelectOption[] = [
    { value: 'all', label: 'All numbers' },
    ...numbers.map((n) => ({ value: n.phone_number, label: n.label || n.phone_number })),
  ];

  return (
    <div className={cn('flex flex-wrap items-center gap-2.5', className)}>
      <div className="w-[240px]">
        <Input
          placeholder="Search message body…"
          value={search}
          icon="search"
          onChange={(v) => onSearchChange?.(v)}
        />
      </div>
      <div className="w-[170px]">
        <Select
          aria-label="Filter by number"
          value={numberFilter}
          options={numberOptions}
          onChange={(v) => onNumberChange?.(v)}
        />
      </div>
      <div className="w-[170px]">
        <Select
          aria-label="Filter by type"
          value={typeFilter}
          options={TYPE_OPTIONS}
          onChange={(v) => onTypeChange?.(v)}
        />
      </div>
    </div>
  );
}
