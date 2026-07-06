import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AvailableGroup, GroupEntry, GroupEzyLinkInput, GroupParticipant } from '@/types';

/** Monitored groups (the registry). */
export function useGroups() {
  return useQuery<GroupEntry[]>({
    queryKey: ['groups'],
    queryFn: () => api.listGroups(),
  });
}

/** Real WhatsApp groups from the linked account, for the "add group conversations"
 * picker. Only fetched while `enabled` (the picker modal open) — it's a live call. */
export function useAvailableGroups(enabled: boolean) {
  return useQuery<AvailableGroup[]>({
    queryKey: ['available-groups'],
    queryFn: () => api.listAvailableGroups(),
    enabled,
    staleTime: 60_000,
  });
}

/** Live participant list of a monitored group, for the compose @-mention picker.
 * Only fetched while `enabled` (a mention query is active) — it's a live WhatsApp
 * call. Keyed by group id so switching groups refetches. */
export function useGroupParticipants(groupId: string | null, enabled: boolean) {
  return useQuery<GroupParticipant[]>({
    queryKey: ['group-participants', groupId],
    queryFn: () => api.listGroupParticipants(groupId as string),
    enabled: enabled && !!groupId,
    staleTime: 60_000,
  });
}

/** Add several groups at once (from the group picker). Tolerates partial failure. */
export function useAddGroupsBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (groups: { groupId: string; chatId: string; subject?: string }[]) => {
      const results = await Promise.allSettled(
        groups.map((g) => api.addGroup(g.groupId, g.chatId, g.subject)),
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      return { succeeded, failed: results.length - succeeded, total: results.length };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['groups'] });
      void qc.invalidateQueries({ queryKey: ['threads'] });
      void qc.invalidateQueries({ queryKey: ['status'] });
    },
  });
}

export function useRemoveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => api.removeGroup(groupId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['groups'] });
      void qc.invalidateQueries({ queryKey: ['threads'] });
      void qc.invalidateQueries({ queryKey: ['status'] });
    },
  });
}

export function useSetGroupEzyLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, link }: { id: string | number; link: GroupEzyLinkInput }) =>
      api.setGroupEzyLink(id, link),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['groups'] });
      void qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}
