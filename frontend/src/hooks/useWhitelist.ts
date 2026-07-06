import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Gender, PreferredLanguage, WhatsAppContact, WhitelistEntry } from '@/types';

export function useWhitelist() {
  return useQuery<WhitelistEntry[]>({
    queryKey: ['whitelist'],
    queryFn: () => api.listWhitelist(),
  });
}

export function useAddWhitelist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ number, label, gender }: { number: string; label?: string; gender?: Gender }) =>
      api.addWhitelist(number, label, gender),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['whitelist'] });
      void qc.invalidateQueries({ queryKey: ['status'] });
    },
  });
}

export function useRemoveWhitelist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (number: string) => api.removeWhitelist(number),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['whitelist'] });
      void qc.invalidateQueries({ queryKey: ['status'] });
    },
  });
}

/** Edit a whitelist entry's label, preferred language, and/or gender (inline table edit). */
export function useUpdateWhitelist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      label,
      preferred_language,
      gender,
    }: {
      id: string | number;
      label?: string;
      preferred_language?: PreferredLanguage;
      gender?: Gender;
    }) => api.updateWhitelistEntry(id, { label, preferred_language, gender }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['whitelist'] });
      void qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}

/** Real WhatsApp contacts from the linked account, for the "browse contacts" picker.
 * Only fetched while `enabled` (the picker modal being open) — it's a live WhatsApp
 * call, not something to run on every page load. */
export function useWhatsAppContacts(enabled: boolean) {
  return useQuery<WhatsAppContact[]>({
    queryKey: ['whatsapp-contacts'],
    queryFn: () => api.listContacts(),
    enabled,
    staleTime: 60_000,
  });
}

/** Add several numbers at once (from the contact picker). Tolerates partial failure. */
export function useAddWhitelistBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: { number: string; label?: string; gender?: Gender }[]) => {
      const results = await Promise.allSettled(
        entries.map((e) => api.addWhitelist(e.number, e.label, e.gender)),
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      return { succeeded, failed: results.length - succeeded, total: results.length };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['whitelist'] });
      void qc.invalidateQueries({ queryKey: ['status'] });
    },
  });
}
