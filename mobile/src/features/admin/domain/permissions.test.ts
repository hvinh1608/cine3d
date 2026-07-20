import { ApiError, type User } from '@/domain/models';
import { adminAccess, canMutateUser, isAdminForbidden, isSessionExpired } from './permissions';

const user = (role: string): User => ({ id: 'me', email: 'a@b.co', username: 'a', role, isVip: false });

describe('admin permissions and API status', () => {
  it('allows only hydrated ADMIN sessions', () => {
    expect(adminAccess(false, null)).toBe('loading');
    expect(adminAccess(true, null)).toBe('signed-out');
    expect(adminAccess(true, user('USER'))).toBe('forbidden');
    expect(adminAccess(true, user('ADMIN'))).toBe('allowed');
  });
  it('recognizes server authorization/session failures', () => {
    expect(isAdminForbidden(new ApiError('No', 403))).toBe(true);
    expect(isSessionExpired(new ApiError('Expired', 401))).toBe(true);
    expect(canMutateUser('me', 'me')).toBe(false);
    expect(canMutateUser('me', 'other')).toBe(true);
  });
});
