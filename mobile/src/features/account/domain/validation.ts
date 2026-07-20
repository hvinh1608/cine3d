export type AuthFieldErrors = Partial<Record<'email' | 'username' | 'password' | 'confirmPassword', string>>;

export function validateEmail(value: string): string | undefined {
  return /^\S+@\S+\.\S+$/.test(value.trim()) ? undefined : 'Email không hợp lệ.';
}

export function validatePassword(value: string): string | undefined {
  return value.length >= 8 ? undefined : 'Mật khẩu phải có ít nhất 8 ký tự.';
}

export function validateAuthForm(input: {
  email: string;
  password: string;
  username?: string;
  confirmPassword?: string;
}): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  errors.email = validateEmail(input.email);
  errors.password = validatePassword(input.password);
  if (input.username !== undefined && (input.username.trim().length < 3 || input.username.trim().length > 40)) {
    errors.username = 'Tên hiển thị phải từ 3 đến 40 ký tự.';
  }
  if (input.confirmPassword !== undefined && input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
  }
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => value)) as AuthFieldErrors;
}

export function validProfilePin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
