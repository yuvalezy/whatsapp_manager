import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { AddNumberForm } from '@/components/domain/AddNumberForm';
import { WhitelistTable } from '@/components/domain/WhitelistTable';
import { useWhitelist, useAddWhitelist, useRemoveWhitelist } from '@/hooks/useWhitelist';
import { useToast } from '@/components/ui/Toast';
import { formatPhone } from '@/lib/format';

export function WhitelistPage() {
  const { data: whitelist, isLoading } = useWhitelist();
  const add = useAddWhitelist();
  const remove = useRemoveWhitelist();
  const { toast } = useToast();
  const [removingId, setRemovingId] = useState<string | number | null>(null);

  return (
    <>
      <PageHeader
        title="Whitelist"
        subtitle="Only inbound messages from these numbers are ever captured. Everything else is counted and dropped."
      />
      <div className="flex flex-col gap-[22px] p-7">
        <AddNumberForm
          submitting={add.isPending}
          onAdd={({ number, label }) =>
            add.mutate(
              { number, label },
              {
                onSuccess: (entry) =>
                  toast({
                    tone: 'success',
                    title: 'Number whitelisted',
                    description: `${formatPhone(entry.phone_number)} will now be monitored.`,
                  }),
                onError: (e) =>
                  toast({
                    tone: 'danger',
                    title: 'Could not add number',
                    description: e instanceof Error ? e.message : 'Please try again.',
                  }),
              },
            )
          }
        />
        <WhitelistTable
          rows={whitelist ?? []}
          loading={isLoading}
          deletingId={removingId}
          onDelete={(id) => {
            const row = (whitelist ?? []).find((r) => r.id === id);
            if (!row) return;
            setRemovingId(id);
            remove.mutate(row.phone_number, {
              onSuccess: () => toast({ tone: 'success', title: 'Number removed' }),
              onError: (e) =>
                toast({
                  tone: 'danger',
                  title: 'Could not remove number',
                  description: e instanceof Error ? e.message : 'Please try again.',
                }),
              onSettled: () => setRemovingId(null),
            });
          }}
        />
      </div>
    </>
  );
}
