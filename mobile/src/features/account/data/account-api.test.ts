import { apiClient } from '@/data/http/api-client';
import { accountApi } from './account-api';

jest.mock('@/data/http/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

describe('native account API contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends credentials to the native session endpoint', async () => {
    mockedClient.post.mockResolvedValueOnce({
      data: { accessToken: 'access', refreshToken: 'refresh', user: { id: 'u1' } },
    } as never);

    await accountApi.login('user@example.com', 'password123');

    expect(mockedClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'user@example.com',
      password: 'password123',
    });
  });

  it('uses the JSON email verification contract', async () => {
    mockedClient.post.mockResolvedValueOnce({
      data: { message: 'verified', verified: true },
    } as never);

    await accountApi.verifyEmail('verification-token');

    expect(mockedClient.post).toHaveBeenCalledWith('/auth/verify-email', {
      token: 'verification-token',
    });
  });

  it('sends Google Play purchase proof only to the backend', async () => {
    mockedClient.post.mockResolvedValueOnce({ data: { purchase: { status: 'ACTIVE' } } } as never);

    await accountApi.verifyGooglePurchase('vip.monthly', 'purchase-token');

    expect(mockedClient.post).toHaveBeenCalledWith('/billing/google/verify', {
      productId: 'vip.monthly',
      purchaseToken: 'purchase-token',
    });
  });
});
