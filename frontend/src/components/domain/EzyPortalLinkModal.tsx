import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { useCreateEzyContact, useEzyBusinessPartners, useEzyContacts } from '@/hooks/useEzyPortal';
import type { EzyBusinessPartner, EzyLinkInput, WhitelistEntry } from '@/types';

// ============================================================================
// EzyPortalLinkModal — link a whitelisted number to an EZY Portal business
// partner + contact. Step 1: search/select the BP. Step 2: pick one of its
// contacts, or create a new one inline (auto-selected once created).
// ============================================================================

export interface EzyPortalLinkModalProps {
  open: boolean;
  entry: WhitelistEntry | null;
  submitting?: boolean;
  error?: string | null;
  onClose?: () => void;
  onSave?: (link: EzyLinkInput) => void;
}

/**
 * Split a whitelist label into a first/last name guess for the new-contact
 * form. 1 word -> first only. 2 -> first/last. 3 -> first gets 1, last gets
 * the rest (surnames are more often multi-word than given names). 4+ -> split
 * evenly, extra word favoring the first name.
 */
function splitLabelName(label: string): { firstName: string; lastName: string } {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: '', lastName: '' };
  if (words.length === 1) return { firstName: words[0], lastName: '' };
  if (words.length <= 3) return { firstName: words[0], lastName: words.slice(1).join(' ') };
  const mid = Math.ceil(words.length / 2);
  return { firstName: words.slice(0, mid).join(' '), lastName: words.slice(mid).join(' ') };
}

const ROLE_OPTIONS = [
  { value: 'primary', label: 'Primary' },
  { value: 'billing', label: 'Billing' },
  { value: 'purchasing', label: 'Purchasing' },
  { value: 'technical', label: 'Technical' },
  { value: 'decision_maker', label: 'Decision maker' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'other', label: 'Other' },
];

export function EzyPortalLinkModal({ open, entry, submitting = false, error, onClose, onSave }: EzyPortalLinkModalProps) {
  const [search, setSearch] = useState('');
  const [selectedBp, setSelectedBp] = useState<EzyBusinessPartner | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showNewContact, setShowNewContact] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newRole, setNewRole] = useState('other');
  const [newEmail, setNewEmail] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');

  // Always start from a clean slate on open, seeded from the entry's current link (if any).
  useEffect(() => {
    if (!open) return;
    setSearch('');
    setShowNewContact(false);
    const { firstName, lastName } = splitLabelName(entry?.label ?? '');
    setNewFirstName(firstName);
    setNewLastName(lastName);
    setNewJobTitle('');
    setNewRole('other');
    setNewEmail('');
    setNewMobile('');
    setNewWhatsapp(entry ? `+${entry.phone_number}` : '');
    if (entry?.ezy_bp_id) {
      setSelectedBp({
        id: entry.ezy_bp_id,
        code: entry.ezy_bp_code ?? '',
        name: entry.ezy_bp_name ?? '',
        status: 'active',
        roles: [],
      });
      setSelectedContactId(entry.ezy_contact_id ?? null);
    } else {
      setSelectedBp(null);
      setSelectedContactId(null);
    }
  }, [open, entry]);

  const bpResults = useEzyBusinessPartners(search, open && selectedBp == null);
  const contacts = useEzyContacts(selectedBp?.id ?? null);
  const createContact = useCreateEzyContact(selectedBp?.id ?? null);

  const selectedContact = useMemo(
    () => (contacts.data ?? []).find((c) => c.id === selectedContactId) ?? null,
    [contacts.data, selectedContactId],
  );

  const handlePickBp = (bp: EzyBusinessPartner) => {
    setSelectedBp(bp);
    setSelectedContactId(null);
  };

  const handleChangeBp = () => {
    setSelectedBp(null);
    setSelectedContactId(null);
    setShowNewContact(false);
  };

  const handleCreateContact = () => {
    if (!selectedBp || !newFirstName.trim() || !newLastName.trim()) return;
    createContact.mutate(
      {
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        jobTitle: newJobTitle.trim() || undefined,
        role: newRole,
        email: newEmail.trim() || undefined,
        mobile: newMobile.trim() || undefined,
        whatsapp: newWhatsapp.trim() || undefined,
      },
      {
        onSuccess: (created) => {
          setSelectedContactId(created.id);
          setShowNewContact(false);
        },
      },
    );
  };

  const handleSave = () => {
    if (!selectedBp || !selectedContact) return;
    onSave?.({
      bpId: selectedBp.id,
      bpCode: selectedBp.code,
      bpName: selectedBp.name,
      contactId: selectedContact.id,
      contactName: `${selectedContact.firstName} ${selectedContact.lastName}`.trim(),
    });
  };

  return (
    <Modal
      open={open}
      title="Link to EZY Portal"
      description={
        entry ? `Set the business partner and contact for ${entry.label || `+${entry.phone_number}`}.` : undefined
      }
      size="lg"
      primaryLabel="Save link"
      primaryDisabled={selectedBp == null || selectedContact == null}
      loading={submitting}
      hideFooter={selectedBp == null}
      onPrimary={handleSave}
      onSecondary={onClose}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        {error && (
          <div className="rounded-wm-sm border border-danger/40 bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        {selectedBp == null ? (
          <>
            <Input
              placeholder="Search business partners by name or code…"
              value={search}
              icon="search"
              onChange={setSearch}
              autoFocus
            />
            {bpResults.isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton width="100%" height="42px" />
                <Skeleton width="100%" height="42px" />
                <Skeleton width="100%" height="42px" />
              </div>
            ) : bpResults.isError ? (
              <EmptyState
                icon="alertCircle"
                title="Couldn't load business partners"
                description="Check the EZY Portal API key in Settings."
              />
            ) : (bpResults.data ?? []).length === 0 ? (
              <div className="py-6 text-center text-[13px] text-fg-muted">
                No business partners match "{search}".
              </div>
            ) : (
              <div className="flex max-h-[360px] flex-col gap-1 overflow-y-auto">
                {(bpResults.data ?? []).map((bp) => (
                  <button
                    key={bp.id}
                    type="button"
                    onClick={() => handlePickBp(bp)}
                    className="flex w-full items-center gap-3 rounded-wm border border-transparent px-2.5 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-muted">
                      <Icon name="briefcase" size={15} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col items-start">
                      <span className="truncate text-[13.5px] font-medium text-fg">{bp.name}</span>
                      <span className="truncate text-[11.5px] text-fg-muted">{bp.code}</span>
                    </div>
                    <Badge label={bp.status} tone={bp.status === 'active' ? 'success' : 'neutral'} />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 rounded-wm border border-line-strong bg-surface-2 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <Icon name="briefcase" size={15} className="shrink-0 text-fg-muted" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[13.5px] font-semibold text-fg">{selectedBp.name}</span>
                  {selectedBp.code && <span className="truncate text-[11px] text-fg-muted">{selectedBp.code}</span>}
                </div>
              </div>
              <Button variant="ghost" size="sm" label="Change" onClick={handleChangeBp} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-fg-muted">Contact</span>
              <Button
                variant="secondary"
                size="sm"
                icon="plus"
                label="New contact"
                onClick={() => setShowNewContact((v) => !v)}
              />
            </div>

            {showNewContact && (
              <div className="flex flex-col gap-3 rounded-wm border border-line-strong bg-surface p-3">
                <div className="flex flex-wrap gap-3">
                  <Input
                    label="First name"
                    required
                    value={newFirstName}
                    onChange={setNewFirstName}
                    className="min-w-[140px] flex-1"
                  />
                  <Input
                    label="Last name"
                    required
                    value={newLastName}
                    onChange={setNewLastName}
                    className="min-w-[140px] flex-1"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Select label="Role" value={newRole} options={ROLE_OPTIONS} onChange={setNewRole} className="w-[180px]" />
                  <Input label="Job title" value={newJobTitle} onChange={setNewJobTitle} className="min-w-[140px] flex-1" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Input label="Email" value={newEmail} onChange={setNewEmail} className="min-w-[180px] flex-1" />
                  <Input label="Mobile" value={newMobile} onChange={setNewMobile} className="w-[160px]" />
                  <Input label="WhatsApp" value={newWhatsapp} onChange={setNewWhatsapp} className="w-[160px]" />
                </div>
                {createContact.isError && (
                  <span className="text-xs text-danger">
                    {createContact.error instanceof Error ? createContact.error.message : 'Could not create contact.'}
                  </span>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" label="Cancel" onClick={() => setShowNewContact(false)} />
                  <Button
                    variant="primary"
                    size="sm"
                    label="Create contact"
                    loading={createContact.isPending}
                    disabled={!newFirstName.trim() || !newLastName.trim()}
                    onClick={handleCreateContact}
                  />
                </div>
              </div>
            )}

            {contacts.isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton width="100%" height="42px" />
                <Skeleton width="100%" height="42px" />
              </div>
            ) : contacts.isError ? (
              <EmptyState icon="alertCircle" title="Couldn't load contacts" description="Please try again." />
            ) : (contacts.data ?? []).length === 0 && !showNewContact ? (
              <EmptyState icon="user" title="No contacts yet" description="Create one above to link it." />
            ) : (
              <div className="flex max-h-[280px] flex-col gap-1 overflow-y-auto">
                {(contacts.data ?? []).map((c) => {
                  const selected = c.id === selectedContactId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedContactId(c.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-wm border px-2.5 py-2 text-left transition-colors',
                        selected
                          ? 'border-primary bg-primary-soft'
                          : 'border-transparent hover:border-line-strong hover:bg-surface-2',
                      )}
                    >
                      {selected ? (
                        <Icon name="checkCircle" size={17} className="shrink-0 text-primary" />
                      ) : (
                        <span className="h-[17px] w-[17px] shrink-0 rounded-full border border-line-strong" />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col items-start">
                        <span className="truncate text-[13.5px] font-medium text-fg">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="truncate text-[11.5px] text-fg-muted">
                          {c.role}
                          {c.email ? ` · ${c.email}` : ''}
                          {c.whatsapp ? ` · ${c.whatsapp}` : c.mobile ? ` · ${c.mobile}` : ''}
                        </span>
                      </div>
                      {c.isPrimary && <Badge label="Primary" tone="info" />}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
