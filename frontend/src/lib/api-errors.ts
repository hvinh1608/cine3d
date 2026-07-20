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
  'Facebook access token is required.': 'Thiếu thông tin đăng nhập Facebook.',
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
  'Internal server error.': 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.',
  'Network Error': 'Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.',
};

export function localizeApiMessage(message: string, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.'): string {
  const trimmed = message.trim();
  if (!trimmed) return fallback;
  if (API_MESSAGE_VI[trimmed]) return API_MESSAGE_VI[trimmed];
  const lower = trimmed.toLowerCase();
  if (lower.includes('invalid credentials')) return 'Email hoặc mật khẩu không đúng.';
  if (lower.includes('network error') || lower.includes('failed to fetch')) {
    return 'Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.';
  }
  return trimmed;
}
