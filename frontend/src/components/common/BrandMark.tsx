/** Dấu hiệu nhận diện của FinNexus KG.
 *
 * Cùng một hình với `public/icon.svg`, dựng bằng React để dùng trong giao diện:
 * bốn nút của đồ thị tri thức đặt đúng trên đường đi của giá, nút cuối là "chủ
 * thể" — mã trung tâm của bài báo.
 *
 * Trước đây sidebar và trang đăng nhập mượn icon `GitBranch` của thư viện
 * lucide, tức là sản phẩm không có dấu hiệu riêng nào và trông giống mọi ứng
 * dụng khác dùng cùng bộ icon đó.
 */
/** Xanh dương là màu của sản phẩm; xanh lá dành riêng cho khu quản trị, giữ lại
 * cách phân biệt màu mà giao diện cũ đã dùng để người quản trị biết mình đang ở
 * đâu chỉ bằng cái liếc mắt. */
const TONES = {
  brand: ['#1d4ed8', '#0ea5e9'],
  admin: ['#047857', '#10b981'],
} as const

export default function BrandMark({
  size = 36,
  /** Bọc trong ô bo góc nền gradient. Tắt đi khi cần đặt hình lên nền có sẵn. */
  tile = true,
  tone = 'brand',
  className,
}: {
  size?: number
  tile?: boolean
  tone?: keyof typeof TONES
  className?: string
}) {
  const id = `brandTile-${tone}`
  const [from, to] = TONES[tone]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="FinNexus KG"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>

      {tile && <rect width="64" height="64" rx="15" fill={`url(#${id})`} />}

      {/* Nhánh phụ: một mã cùng ngành, không nằm trên đường chính */}
      <path d="M27 31 L24 17" stroke="#ffffff" strokeOpacity={0.4} strokeWidth={2} strokeLinecap="round" fill="none" />
      <circle cx="24" cy="17" r="3" fill="#ffffff" fillOpacity={0.55} />

      {/* Cạnh nối: vừa là quan hệ trong đồ thị, vừa là đường giá */}
      <path
        d="M15 45 L27 31 L40 36 L50 19"
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.85}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx="15" cy="45" r="4" fill="#ffffff" fillOpacity={0.8} />
      <circle cx="27" cy="31" r="4" fill="#ffffff" fillOpacity={0.8} />
      <circle cx="40" cy="36" r="4" fill="#ffffff" fillOpacity={0.8} />

      {/* Nút chủ thể */}
      <circle cx="50" cy="19" r="8.5" fill="#ffffff" fillOpacity={0.18} />
      <circle cx="50" cy="19" r="6" fill="#ffffff" />
    </svg>
  )
}
