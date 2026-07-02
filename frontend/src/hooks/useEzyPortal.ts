import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreateEzyContactInput, EzyBusinessPartner, EzyContact, EzyLinkInput } from '@/types';

/** Search EZY Portal business partners by name/code. Only runs while `enabled` (the link modal open). */
export function useEzyBusinessPartners(searchQuery: string, enabled: boolean) {
  return useQuery<EzyBusinessPartner[]>({
    queryKey: ['ezy-portal', 'business-partners', searchQuery],
    queryFn: () => api.listEzyBusinessPartners(searchQuery || undefined),
    enabled,
    staleTime: 30_000,
  });
}

/** Contacts for a single business partner. Only fetched once a BP is selected. */
export function useEzyContacts(bpId: string | null) {
  return useQuery<EzyContact[]>({
    queryKey: ['ezy-portal', 'contacts', bpId],
    queryFn: () => api.listEzyContacts(bpId as string),
    enabled: bpId != null,
  });
}

export function useCreateEzyContact(bpId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEzyContactInput) => api.createEzyContact(bpId as string, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ezy-portal', 'contacts', bpId] });
    },
  });
}

export function useSetWhitelistEzyLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, link }: { id: string | number; link: EzyLinkInput }) =>
      api.setWhitelistEzyLink(id, link),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['whitelist'] });
    },
  });
}
