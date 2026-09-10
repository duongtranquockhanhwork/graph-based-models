// Quy ước màu bảng giá chứng khoán Việt Nam (giống iBoard/mọi bảng giá sàn HSX/HNX)
export const COLOR_CEILING = '#c084fc' // tím = trần
export const COLOR_FLOOR = '#38bdf8' // xanh lam = sàn
export const COLOR_REFERENCE = '#facc15' // vàng = tham chiếu

/** So màu đúng quy ước bảng giá: giá chạm trần/sàn tô tím/xanh lam dù dấu
 * change vẫn dương/âm — khác với chỉ nhìn dấu của change như trước. */
export function trendColor(change: number, price?: number, ceiling?: number, floor?: number) {
  if (price != null && ceiling != null && price >= ceiling) return COLOR_CEILING
  if (price != null && floor != null && price <= floor) return COLOR_FLOOR
  if (change > 0) return '#10b981'
  if (change < 0) return '#ef4444'
  return COLOR_REFERENCE
}

export function fmtNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('vi-VN')
}
