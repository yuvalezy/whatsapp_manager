import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CredentialsList } from '@/types';

/** Stored provider API keys (masked — name + last4 only). */
export function useCredentials() {
  return useQuery<CredentialsList>({
    queryKey: ['credentials'],
    queryFn: () => api.listCredentials(),
  });
}

export function useSetCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, value }: { name: string; value: string }) =>
      api.setCredential(name, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['credentials'] });
      void qc.invalidateQueries({ queryKey: ['status'] });
    },
  });
}

export function useDeleteCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.deleteCredential(name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['credentials'] });
      void qc.invalidateQueries({ queryKey: ['status'] });
    },
  });
}
