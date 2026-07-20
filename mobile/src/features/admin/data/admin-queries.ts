import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminRepository } from './admin-repository';

export const adminKeys = {
  all: ['admin'] as const,
  stats: ['admin', 'stats'] as const,
  analytics: ['admin', 'analytics'] as const,
  movies: (page: number, search: string) => ['admin', 'movies', page, search] as const,
  metadata: ['admin', 'metadata'] as const,
  users: ['admin', 'users'] as const,
  orders: ['admin', 'orders'] as const,
  reports: ['admin', 'reports'] as const,
  feedback: ['admin', 'feedback'] as const,
  sources: ['admin', 'sources'] as const,
};

export function useAdminDashboard(enabled: boolean) {
  const stats = useQuery({ queryKey: adminKeys.stats, queryFn: adminRepository.stats, enabled });
  const analytics = useQuery({ queryKey: adminKeys.analytics, queryFn: adminRepository.analytics, enabled });
  return { stats, analytics };
}
export const useAdminMovies = (page: number, search: string, enabled: boolean) =>
  useQuery({ queryKey: adminKeys.movies(page, search), queryFn: () => adminRepository.movies(page, search), enabled });
export const useAdminMetadata = (enabled: boolean) =>
  useQuery({ queryKey: adminKeys.metadata, queryFn: async () => ({ countries: await adminRepository.countries(), genres: await adminRepository.genres() }), enabled });
export const useAdminUsers = (enabled: boolean) => useQuery({ queryKey: adminKeys.users, queryFn: adminRepository.users, enabled });
export const useAdminOrders = (enabled: boolean) => useQuery({ queryKey: adminKeys.orders, queryFn: adminRepository.orders, enabled });
export const useAdminReports = (enabled: boolean) => useQuery({ queryKey: adminKeys.reports, queryFn: adminRepository.reports, enabled });
export const useAdminFeedback = (enabled: boolean) => useQuery({ queryKey: adminKeys.feedback, queryFn: adminRepository.feedback, enabled });
export const useAdminSources = (enabled: boolean) => useQuery({ queryKey: adminKeys.sources, queryFn: adminRepository.sourceHealth, enabled });

export function useAdminMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  invalidate: readonly (readonly unknown[])[],
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => Promise.all(invalidate.map((key) => client.invalidateQueries({ queryKey: key }))),
  });
}
