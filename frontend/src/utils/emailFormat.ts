// Yêu cầu sản phẩm: chỉ nhận email @gmail.com cho luồng OTP (đăng ký/liên kết
// email) — một nơi duy nhất để form nào dùng email OTP cũng validate giống nhau.
const GMAIL_RE = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i

// Nhận `t` từ useLanguage() của nơi gọi — bản thân file util này không phải
// component nên không thể tự dùng hook.
export function getEmailFormatMessage(t: (key: string, params?: Record<string, string | number>) => string): string {
  return t('auth.emailFormatInvalid')
}

export function isGmailAddress(email: string): boolean {
  return GMAIL_RE.test(email.trim())
}
