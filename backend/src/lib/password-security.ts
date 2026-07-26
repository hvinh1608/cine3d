import * as bcrypt from 'bcrypt';

export const PASSWORD_HASH_ROUNDS = 12;
export const PASSWORD_HISTORY_LIMIT = 5;
export const PASSWORD_MIN_LENGTH = 8;
export const BCRYPT_MAX_PASSWORD_BYTES = 72;

export function passwordValidationError(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`;
  }
  if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_PASSWORD_BYTES) {
    return `Mật khẩu không được vượt quá ${BCRYPT_MAX_PASSWORD_BYTES} byte.`;
  }
  return null;
}

export async function passwordMatchesAny(
  candidate: string,
  passwordHashes: Array<string | null | undefined>,
): Promise<boolean> {
  for (const hash of passwordHashes) {
    if (hash && await bcrypt.compare(candidate, hash)) return true;
  }
  return false;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
}
