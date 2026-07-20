import { validateAuthForm, validProfilePin } from './validation';

describe('account validation', () => {
  it('rejects invalid login and registration values', () => {
    expect(validateAuthForm({ email: 'bad', password: '123', username: 'x', confirmPassword: '456' })).toEqual({
      email: 'Email không hợp lệ.',
      password: 'Mật khẩu phải có ít nhất 8 ký tự.',
      username: 'Tên hiển thị phải từ 3 đến 40 ký tự.',
      confirmPassword: 'Mật khẩu xác nhận không khớp.',
    });
  });
  it('accepts valid credentials and only four digit PINs', () => {
    expect(validateAuthForm({ email: 'vinh@example.com', password: 'password1' })).toEqual({});
    expect(validProfilePin('1234')).toBe(true);
    expect(validProfilePin('12a4')).toBe(false);
    expect(validProfilePin('12345')).toBe(false);
  });
});
