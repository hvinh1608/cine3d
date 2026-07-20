const ALLOWED_ROUTES = [
  /^\/(?:search|schedule|downloads|watch-together)(?:[/?#]|$)/,
  /^\/(?:movies?|watch|the-loai|quoc-gia|nam|actors|directors|playlists)\/[a-zA-Z0-9_-]+(?:[/?#]|$)/,
  /^\/account\/(?:auth|profile|profiles|sessions|notifications|feedback|settings|vip|legal)(?:[/?#]|$)/,
];

export function sanitizeDeepLink(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u001f\\]/.test(value)) return null;
  let route = value.trim();
  try {
    const url = new URL(route);
    if (url.protocol !== 'https:' || url.hostname !== 'cine3d.id.vn') return null;
    route = `${url.pathname}${url.search}${url.hash}`;
  } catch {
    if (!route.startsWith('/') || route.startsWith('//')) return null;
  }
  try {
    route = decodeURI(route);
  } catch {
    return null;
  }
  if (route.includes('..') || !ALLOWED_ROUTES.some((pattern) => pattern.test(route))) return null;
  return route;
}

export function isIdempotentMethod(method?: string): boolean {
  return ['get', 'head', 'options', 'put', 'delete'].includes((method || 'get').toLowerCase());
}

export function shouldRetryRequest(
  failureCount: number,
  error: unknown,
  method = 'get',
): boolean {
  if (!isIdempotentMethod(method) || failureCount >= 2) return false;
  const status = typeof error === 'object' && error && 'status' in error
    ? Number((error as { status?: number }).status)
    : undefined;
  return status == null || status === 408 || status === 429 || status >= 500;
}

export function redactErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unexpected error';
  return localizeApiMessage(
    message
      .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
      .replace(/([?&](?:token|access_token|refresh_token|key)=)[^&#\s]+/gi, '$1[REDACTED]')
      .slice(0, 300),
  );
}

const API_MESSAGE_VI: Record<string, string> = {
  'Invalid credentials.': 'Email hoặc mật khẩu không đúng.',
  'Invalid credentials': 'Email hoặc mật khẩu không đúng.',
  'Email and password are required.': 'Vui lòng nhập email và mật khẩu.',
  'All fields are required.': 'Vui lòng điền đầy đủ thông tin.',
  'A valid email address is required.': 'Email không hợp lệ.',
  'Username must be between 3 and 40 characters.': 'Tên tài khoản phải từ 3 đến 40 ký tự.',
  'Password must be at least 8 characters.': 'Mật khẩu phải có ít nhất 8 ký tự.',
  'Account is locked. Please contact support.': 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.',
  'Google credential is required.': 'Thiếu thông tin đăng nhập Google.',
  'Invalid or expired refresh token.': 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
  'Invalid or expired reset token.': 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
  'Invalid or expired verification token.': 'Liên kết xác nhận không hợp lệ hoặc đã hết hạn.',
  'Invalid or expired token.': 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
  'Authentication token required.': 'Bạn cần đăng nhập để tiếp tục.',
  'Account is unavailable or locked.': 'Tài khoản không khả dụng hoặc đã bị khóa.',
  'Access denied. Administrator privileges required.': 'Bạn không có quyền quản trị.',
  'Unauthorized.': 'Bạn cần đăng nhập để tiếp tục.',
  'User not found.': 'Không tìm thấy tài khoản.',
  'Email is required.': 'Vui lòng nhập email.',
  'Reset token and new password are required.': 'Thiếu mã đặt lại mật khẩu hoặc mật khẩu mới.',
  'Verification token is required.': 'Thiếu mã xác nhận email.',
  'Password updated successfully.': 'Đã cập nhật mật khẩu.',
  'Email verified successfully.': 'Email đã được xác nhận.',
  'Logged out successfully.': 'Đã đăng xuất.',
  'User registered successfully.': 'Đăng ký thành công.',
  'Network request failed': 'Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.',
  'Request timed out': 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.',
  'Session expired': 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
  'Unexpected error': 'Đã xảy ra lỗi. Vui lòng thử lại.',
  'Internal server error.': 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.',
};

export function localizeApiMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  if (API_MESSAGE_VI[trimmed]) return API_MESSAGE_VI[trimmed];
  const lower = trimmed.toLowerCase();
  if (lower.includes('invalid credentials')) return 'Email hoặc mật khẩu không đúng.';
  if (lower.includes('network request failed') || lower.includes('failed to fetch')) {
    return 'Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.';
  }
  return trimmed;
}
