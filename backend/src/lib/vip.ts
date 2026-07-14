export type VipAccessUser = {
  isVip: boolean;
  vipExpiresAt: Date | null;
  isLocked?: boolean;
};

export function hasVipAccess(user: VipAccessUser | null | undefined, now = new Date()): boolean {
  if (!user || user.isLocked) return false;
  return user.isVip || (user.vipExpiresAt !== null && user.vipExpiresAt.getTime() > now.getTime());
}

export function extendVipExpiry(currentExpiry: Date | null, durationDays: number, now = new Date()): Date {
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  return new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
}
