// Avatar được lưu thẳng dưới dạng data URI trong DB (không có nơi lưu file
// riêng trong hệ thống — xem backend/app/schemas/auth.py). Vì vậy phải nén
// nhỏ ở đây trước khi gửi lên: cắt vuông ở giữa rồi thu về kích thước cố
// định, để avatar tròn luôn hiển thị đúng tỉ lệ và dung lượng luôn nhỏ.
const AVATAR_SIZE = 200
const AVATAR_JPEG_QUALITY = 0.85
const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024

export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn một file ảnh')
  }
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    throw new Error('Ảnh quá lớn (tối đa 10MB)')
  }

  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh')
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)

  return canvas.toDataURL('image/jpeg', AVATAR_JPEG_QUALITY)
}
