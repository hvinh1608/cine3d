import type { User } from '@/domain/models';

/** Matches web/backend VIP semantics for ad suppression. */
export function isVipActive(user: Pick<User, 'isVip' | 'vipExpiresAt'> | null | undefined) {
  if (!user?.isVip) return false;
  if (!user.vipExpiresAt) return true;
  return new Date(user.vipExpiresAt).getTime() > Date.now();
}
