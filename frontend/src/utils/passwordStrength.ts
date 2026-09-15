// Mirror của validate_password_strength ở backend (app/core/security.py).
// Một nơi duy nhất, dùng chung cho đăng ký / đổi mật khẩu / đặt lại mật khẩu —
// tránh ba nơi tự chép lại quy tắc rồi lệch nhau theo thời gian.
export const PASSWORD_MIN_LENGTH = 8

// Nhận `t` từ useLanguage() của nơi gọi — bản thân file util này không phải
// component nên không thể tự dùng hook.
export function getPasswordRequirementsMessage(t: (key: string, params?: Record<string, string | number>) => string): string {
  return t('auth.passwordRequirements', { minLength: PASSWORD_MIN_LENGTH })
}

export function isPasswordStrong(password: string): boolean {
  if (password.length < PASSWORD_MIN_LENGTH) return false
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].every((re) => re.test(password))
}
