import { isIdempotentMethod, localizeApiMessage, sanitizeDeepLink, shouldRetryRequest } from './reliability';

describe('deep link sanitizer', () => {
  it('accepts known internal routes and canonical https links', () => {
    expect(sanitizeDeepLink('/movies/a-film?ep=2')).toBe('/movies/a-film?ep=2');
    expect(sanitizeDeepLink('https://cine3d.id.vn/watch/a-film')).toBe('/watch/a-film');
  });

  it('rejects traversal, protocol-relative and foreign links', () => {
    expect(sanitizeDeepLink('//evil.example/watch/x')).toBeNull();
    expect(sanitizeDeepLink('/movies/../account/auth')).toBeNull();
    expect(sanitizeDeepLink('javascript:alert(1)')).toBeNull();
    expect(sanitizeDeepLink('https://evil.example/movies/x')).toBeNull();
  });
});

describe('retry policy', () => {
  it('retries only bounded idempotent transient failures', () => {
    expect(isIdempotentMethod('GET')).toBe(true);
    expect(shouldRetryRequest(0, { status: 503 }, 'get')).toBe(true);
    expect(shouldRetryRequest(0, { status: 400 }, 'get')).toBe(false);
    expect(shouldRetryRequest(0, { status: 503 }, 'post')).toBe(false);
    expect(shouldRetryRequest(2, { status: 503 }, 'get')).toBe(false);
  });
});

describe('api error localization', () => {
  it('translates invalid credentials for users', () => {
    expect(localizeApiMessage('Invalid credentials.')).toBe('Email hoặc mật khẩu không đúng.');
    expect(localizeApiMessage('Network request failed')).toBe('Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.');
  });
});
