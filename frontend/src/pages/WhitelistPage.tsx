import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { AddNumberForm } from '@/components/domain/AddNumberForm';
import { WhitelistTable } from '@/components/domain/WhitelistTable';
import { GroupsTable } from '@/components/domain/GroupsTable';
import { ContactPickerModal } from '@/components/domain/ContactPickerModal';
import { GroupPickerModal } from '@/components/domain/GroupPickerModal';
import { EzyPortalLinkModal } from '@/components/domain/EzyPortalLinkModal';
import {
  useWhitelist,
  useAddWhitelist,
  useRemoveWhitelist,
  useWhatsAppContacts,
  useAddWhitelistBulk,
} from '@/hooks/useWhitelist';
import {
  useGroups,
  useAvailableGroups,
  useAddGroupsBulk,
  useRemoveGroup,
  useSetGroupEzyLink,
} from '@/hooks/useGroups';
import { useSetWhitelistEzyLink } from '@/hooks/useEzyPortal';
import { useToast } from '@/components/ui/Toast';
import { formatPhone } from '@/lib/format';
import { ApiError } from '@/lib/api';
import type { GroupEntry, WhitelistEntry } from '@/types';

export function WhitelistPage() {
  const { data: whitelist, isLoading } = useWhitelist();
  const add = useAddWhitelist();
  const remove = useRemoveWhitelist();
  const { toast } = useToast();
  const [removingId, setRemovingId] = useState<string | number | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const contacts = useWhatsAppContacts(pickerOpen);
  const addBulk = useAddWhitelistBulk();

  const [linkingEntry, setLinkingEntry] = useState<WhitelistEntry | null>(null);
  const setEzyLink = useSetWhitelistEzyLink();

  // Groups
  const { data: groups, isLoading: groupsLoading } = useGroups();
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const availableGroups = useAvailableGroups(groupPickerOpen);
  const addGroups = useAddGroupsBulk();
  const removeGroup = useRemoveGroup();
  const [removingGroupId, setRemovingGroupId] = useState<string | number | null>(null);
  const [linkingGroup, setLinkingGroup] = useState<GroupEntry | null>(null);
  const setGroupEzyLink = useSetGroupEzyLink();

  return (
    <>
      <PageHeader
        title="Whitelist"
        subtitle="Only messages from whitelisted numbers and monitored groups are ever captured. Everything else is counted and dropped."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon="users" label="Browse contacts" onClick={() => setPickerOpen(true)} />
            <Button variant="secondary" icon="plus" label="Add group conversations" onClick={() => setGroupPickerOpen(true)} />
          </div>
        }
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
          onLink={(row) => setLinkingEntry(row)}
        />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-semibold text-fg">Group conversations</h2>
            <p className="text-[12.5px] text-fg-muted">
              Monitored groups capture every member's messages. Assign a group to a business partner (no contact needed).
            </p>
          </div>
          <GroupsTable
            rows={groups ?? []}
            loading={groupsLoading}
            deletingId={removingGroupId}
            onDelete={(groupId) => {
              setRemovingGroupId(groupId);
              removeGroup.mutate(groupId, {
                onSuccess: () => toast({ tone: 'success', title: 'Group removed' }),
                onError: (e) =>
                  toast({
                    tone: 'danger',
                    title: 'Could not remove group',
                    description: e instanceof Error ? e.message : 'Please try again.',
                  }),
                onSettled: () => setRemovingGroupId(null),
              });
            }}
            onLink={(row) => setLinkingGroup(row)}
          />
        </div>
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

      <GroupPickerModal
        open={groupPickerOpen}
        groups={availableGroups.data ?? []}
        loading={availableGroups.isLoading}
        error={
          availableGroups.isError
            ? availableGroups.error instanceof ApiError
              ? availableGroups.error.message
              : 'Could not load WhatsApp groups. Please try again.'
            : null
        }
        submitting={addGroups.isPending}
        onClose={() => setGroupPickerOpen(false)}
        onAdd={(entries) => {
          if (entries.length === 0) {
            setGroupPickerOpen(false);
            return;
          }
          addGroups.mutate(entries, {
            onSuccess: (result) => {
              toast({
                tone: result.failed > 0 ? 'warning' : 'success',
                title: `${result.succeeded} group${result.succeeded === 1 ? '' : 's'} monitored`,
                description: result.failed > 0 ? `${result.failed} failed — try again for those.` : undefined,
              });
              setGroupPickerOpen(false);
            },
            onError: (e) =>
              toast({
                tone: 'danger',
                title: 'Could not add groups',
                description: e instanceof Error ? e.message : 'Please try again.',
              }),
          });
        }}
      />

      <EzyPortalLinkModal
        open={linkingEntry != null}
        entry={linkingEntry}
        submitting={setEzyLink.isPending}
        error={setEzyLink.isError ? (setEzyLink.error instanceof Error ? setEzyLink.error.message : 'Could not save link. Please try again.') : null}
        onClose={() => {
          setLinkingEntry(null);
          setEzyLink.reset();
        }}
        onSave={(link) => {
          if (!linkingEntry) return;
          setEzyLink.mutate(
            { id: linkingEntry.id, link },
            {
              onSuccess: () => {
                toast({ tone: 'success', title: 'Linked to EZY Portal', description: `${link.bpName} · ${link.contactName}` });
                setLinkingEntry(null);
              },
            },
          );
        }}
      />

      <EzyPortalLinkModal
        open={linkingGroup != null}
        group={linkingGroup}
        requireContact={false}
        submitting={setGroupEzyLink.isPending}
        error={setGroupEzyLink.isError ? (setGroupEzyLink.error instanceof Error ? setGroupEzyLink.error.message : 'Could not save link. Please try again.') : null}
        onClose={() => {
          setLinkingGroup(null);
          setGroupEzyLink.reset();
        }}
        onSave={(link) => {
          if (!linkingGroup) return;
          setGroupEzyLink.mutate(
            { id: linkingGroup.id, link: { bpId: link.bpId, bpCode: link.bpCode, bpName: link.bpName } },
            {
              onSuccess: () => {
                toast({ tone: 'success', title: 'Group linked to business partner', description: link.bpName });
                setLinkingGroup(null);
              },
            },
          );
        }}
      />
    </>
  );
}
