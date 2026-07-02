import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { AddNumberForm } from '@/components/domain/AddNumberForm';
import { WhitelistTable } from '@/components/domain/WhitelistTable';
import { ContactPickerModal } from '@/components/domain/ContactPickerModal';
import {
  useWhitelist,
  useAddWhitelist,
  useRemoveWhitelist,
  useWhatsAppContacts,
  useAddWhitelistBulk,
} from '@/hooks/useWhitelist';
import { useToast } from '@/components/ui/Toast';
import { formatPhone } from '@/lib/format';
import { ApiError } from '@/lib/api';

export function WhitelistPage() {
  const { data: whitelist, isLoading } = useWhitelist();
  const add = useAddWhitelist();
  const remove = useRemoveWhitelist();
  const { toast } = useToast();
  const [removingId, setRemovingId] = useState<string | number | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const contacts = useWhatsAppContacts(pickerOpen);
  const addBulk = useAddWhitelistBulk();

  return (
    <>
      <PageHeader
        title="Whitelist"
        subtitle="Only inbound messages from these numbers are ever captured. Everything else is counted and dropped."
        actions={<Button variant="secondary" icon="users" label="Browse contacts" onClick={() => setPickerOpen(true)} />}
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

      <ContactPickerModal
        open={pickerOpen}
        contacts={contacts.data ?? []}
        loading={contacts.isLoading}
        error={
          contacts.isError
            ? contacts.error instanceof ApiError
              ? contacts.error.message
              : 'Could not load WhatsApp contacts. Please try again.'
            : null
        }
        submitting={addBulk.isPending}
        onClose={() => setPickerOpen(false)}
        onAdd={(entries) => {
          if (entries.length === 0) {
            setPickerOpen(false);
            return;
          }
          addBulk.mutate(entries, {
            onSuccess: (result) => {
              toast({
                tone: result.failed > 0 ? 'warning' : 'success',
                title: `${result.succeeded} contact${result.succeeded === 1 ? '' : 's'} whitelisted`,
                description: result.failed > 0 ? `${result.failed} failed — try again for those.` : undefined,
              });
              setPickerOpen(false);
            },
            onError: (e) =>
              toast({
                tone: 'danger',
                title: 'Could not add contacts',
                description: e instanceof Error ? e.message : 'Please try again.',
              }),
          });
        }}
      />
    </>
  );
}
