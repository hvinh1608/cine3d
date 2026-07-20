import { ApiError, type User } from '@/domain/models';

export type AdminAccess = 'loading' | 'signed-out' | 'forbidden' | 'allowed';

export function adminAccess(hydrated: boolean, user: User | null): AdminAccess {
  if (!hydrated) return 'loading';
  if (!user) return 'signed-out';
  return user.role === 'ADMIN' ? 'allowed' : 'forbidden';
}

export const isAdminForbidden = (error: unknown) => error instanceof ApiError && error.status === 403;
export const isSessionExpired = (error: unknown) => error instanceof ApiError && error.status === 401;
export const canMutateUser = (currentUserId: string, targetUserId: string) => currentUserId !== targetUserId;
