// Mirror của validate_password_strength ở backend (app/core/security.py).
// Một nơi duy nhất, dùng chung cho đăng ký / đổi mật khẩu / đặt lại mật khẩu —
// tránh ba nơi tự chép lại quy tắc rồi lệch nhau theo thời gian.
export const PASSWORD_MIN_LENGTH = 8

export const PASSWORD_REQUIREMENTS_MESSAGE =
  `Mật khẩu cần tối thiểu ${PASSWORD_MIN_LENGTH} ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt`

export function isPasswordStrong(password: string): boolean {
  if (password.length < PASSWORD_MIN_LENGTH) return false
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].every((re) => re.test(password))
}
