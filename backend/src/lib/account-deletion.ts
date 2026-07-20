export const ACCOUNT_DELETE_CONFIRMATION = 'DELETE_MY_ACCOUNT';

export function isValidAccountDeletionConfirmation(value: unknown): boolean {
  return typeof value === 'string' && value.trim() === ACCOUNT_DELETE_CONFIRMATION;
}

export function requiresPasswordForAccountDeletion(user: {
  googleId?: string | null;
  facebookId?: string | null;
}): boolean {
  return !user.googleId && !user.facebookId;
}
