export const CONTENT_PREVIEW_LIMIT = 500

/** Chia nội dung gốc thành đoạn văn thật (theo dòng trống), và cắt ở ranh
 *  giới từ thay vì cắt cứng giữa chừng một từ. Dùng chung giữa thẻ tin của
 *  khách hàng (NewsCard) và bảng quản trị (AdminNewsPage) — cùng một bài phải
 *  hiện giống nhau ở cả hai nơi. */
export function contentPreviewParagraphs(content: string): { paragraphs: string[]; truncated: boolean } {
  const paragraphs = content
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
  const result: string[] = []
  let used = 0
  let truncated = false
  for (const para of paragraphs) {
    const remaining = CONTENT_PREVIEW_LIMIT - used
    if (remaining <= 0) {
      truncated = true
      break
    }
    if (para.length <= remaining) {
      result.push(para)
      used += para.length
    } else {
      const cut = para.slice(0, remaining)
      const lastSpace = cut.lastIndexOf(' ')
      result.push(`${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`)
      truncated = true
      break
    }
  }
  return { paragraphs: result, truncated }
}
