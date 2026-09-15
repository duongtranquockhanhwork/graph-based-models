import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Boxes, Filter, Info, Maximize2, Newspaper, RefreshCw, Rotate3d, Type } from 'lucide-react'
import { analyticsApi, graphApi } from '../services/api'
import type { GraphData, GraphNode } from '../types'
import { SymbolChip } from '../components/common/Chips'
import { useLanguage } from '../context/LanguageContext'

// Cả hai thư viện đồ thị đều nặng (bản 3D kéo theo Three.js). Nạp động để các
// trang khác không phải tải chúng.
const ForceGraph2D = lazy(() => import('react-force-graph-2d'))
const ForceGraph3D = lazy(() => import('react-force-graph-3d'))

// Giữ đồng bộ với NODE_COLORS ở backend (graph_service.py) — cùng một bảng màu
// nên phần chú giải không thể lệch với phần đồ thị.
const NODE_COLORS: Record<string, string> = {
  news: '#3B82F6',
  stock: '#10B981',
  company: '#8B5CF6',
  industry: '#F59E0B',
  event: '#EF4444',
  sentiment: '#F97316',
}

/** Mức hiển thị nhãn. Đồ thị lớn mà bật hết nhãn thì thành một đám chữ chồng
 *  nhau; tắt hết thì thành một đám chấm vô danh. Ba mức để người dùng chọn. */
type LabelMode = 'key' | 'all' | 'none'

/** Loại nút luôn có nhãn ở chế độ "Nút chính": chúng là các thực thể người dùng
 *  tra cứu. Tin tức và công ty bị ẩn vì nhãn dài và số lượng lớn. */
const KEY_TYPES = new Set(['stock', 'industry', 'event', 'sentiment'])

/** Dưới mức phóng này thì không vẽ nhãn nào. */
const MIN_LABEL_SCALE = 0.7

interface ForceNode extends GraphNode {
  x?: number
  y?: number
}

/** Chữ nổi trong không gian 3D. Chỉ khai báo phần thuộc tính ta thực sự đặt,
 *  để không phải kéo cả kiểu của three vào đây. */
type SpriteTextCtor = new (text: string) => {
  color: string
  textHeight: number
  position: { y: number }
  material: { depthWrite: boolean }
}

function Legend({ counts, labels }: { counts: Record<string, number>; labels: Record<string, string> }) {
  const entries = Object.entries(labels).filter(([key]) => counts[key])
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {entries.map(([key, label]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: NODE_COLORS[key] }} />
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {label}{' '}
            <span className="font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {counts[key]}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

export default function GraphPage() {
  const { t } = useLanguage()
  const NODE_TYPE_LABELS: Record<string, string> = useMemo(
    () => ({
      news: t('graph.nodeTypes.news'),
      stock: t('graph.nodeTypes.stock'),
      company: t('graph.nodeTypes.company'),
      industry: t('graph.nodeTypes.industry'),
      event: t('graph.nodeTypes.event'),
      sentiment: t('graph.nodeTypes.sentiment'),
    }),
    [t],
  )
  const RELATION_LABELS: Record<string, string> = useMemo(
    () => ({
      mentions: t('graph.relations.mentions'),
      represents: t('graph.relations.represents'),
      belongs_to: t('graph.relations.belongs_to'),
      contains_event: t('graph.relations.contains_event'),
      affects: t('graph.relations.affects'),
      has_sentiment: t('graph.relations.has_sentiment'),
      same_industry: t('graph.relations.same_industry'),
    }),
    [t],
  )
  const LABEL_MODES: { key: LabelMode; label: string; hint: string }[] = useMemo(
    () => [
      { key: 'key', label: t('graph.labelModes.keyLabel'), hint: t('graph.labelModes.keyHint') },
      { key: 'all', label: t('graph.labelModes.allLabel'), hint: t('graph.labelModes.allHint') },
      { key: 'none', label: t('graph.labelModes.noneLabel'), hint: t('graph.labelModes.noneHint') },
    ],
    [t],
  )
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const [labelMode, setLabelMode] = useState<LabelMode>('key')
  const [industries, setIndustries] = useState<string[]>([])
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [size, setSize] = useState({ width: 800, height: 520 })
  // three-spritetext chỉ cần cho chế độ 3D. Nạp động khi người dùng bật 3D để
  // nó không vào chunk của trang này.
  const [SpriteText, setSpriteText] = useState<SpriteTextCtor | null>(null)

  const stockFilter = params.get('stock') || ''
  const industryFilter = params.get('industry') || ''

  const containerRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<{
    zoomToFit?: (ms?: number, px?: number) => void
    d3Force?: (name: string) => { strength?: (v: number) => void; distance?: (v: number) => void } | undefined
  } | null>(null)

  /** Nới lực đẩy và độ dài cạnh.
   *
   *  Mặc định của react-force-graph nén 145 nút vào một đám tròn nhỏ giữa
   *  khung — ở mật độ đó nhãn không thể đọc được dù có bật. Đẩy các nút ra xa
   *  nhau rồi căn khung để đồ thị dùng hết chiều rộng có sẵn.
   */
  const spreadLayout = useCallback(() => {
    const g = graphRef.current
    if (!g?.d3Force) return false
    g.d3Force('charge')?.strength?.(-260)
    g.d3Force('link')?.distance?.(70)
    return true
  }, [])

  const setFilter = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params)
      if (value) next.set(key, value)
      else next.delete(key)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const load = useCallback(() => {
    setLoading(true)
    graphApi
      .data({
        stock: stockFilter.trim().toUpperCase() || undefined,
        industry: industryFilter || undefined,
        limit: 300,
      })
      .then((r) => setData(r.data))
      .catch(() => toast.error(t('graph.loadError')))
      .finally(() => setLoading(false))
  }, [stockFilter, industryFilter])

  useEffect(load, [load])

  useEffect(() => {
    if (!data) return
    // Component đồ thị được nạp động (React.lazy), nên ở lần chạy đầu `ref`
    // thường còn rỗng và việc ghi đè lực im lặng không xảy ra — đó là lý do
    // đồ thị vẫn bị nén dù đã cấu hình. Thử lại tới khi ref sẵn sàng.
    let tries = 0
    const id = setInterval(() => {
      if (spreadLayout() || ++tries > 40) clearInterval(id)
    }, 100)
    return () => clearInterval(id)
  }, [data, mode, spreadLayout])

  useEffect(() => {
    if (mode !== '3d' || SpriteText) return
    let cancelled = false
    import('three-spritetext')
      .then((m) => {
        if (!cancelled) setSpriteText(() => m.default as unknown as SpriteTextCtor)
      })
      .catch(() => {
        // Không có nhãn 3D thì đồ thị vẫn dùng được (tooltip khi rê chuột vẫn
        // còn), nên không báo lỗi ồn ào cho người dùng.
      })
    return () => {
      cancelled = true
    }
  }, [mode, SpriteText])

  useEffect(() => {
    analyticsApi
      .dashboard()
      .then((r) => setIndustries((r.data.top_industries || []).map((i: { industry: string }) => i.industry)))
      .catch(() => setIndustries([]))
  }, [])

  // Đồ thị lực cần kích thước pixel tuyệt đối, không nhận %, nên phải đo
  // container và cập nhật khi cửa sổ đổi kích thước.
  useEffect(() => {
    const measure = () => {
      const el = containerRef.current
      if (!el) return
      setSize({ width: el.clientWidth, height: Math.max(360, el.clientHeight) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] }
    const ids = new Set(data.nodes.map((n) => n.id))
    return {
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.edges
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e) => ({ source: e.source, target: e.target, relation: e.relation })),
    }
  }, [data])

  // Lân cận của nút đang rê/chọn, để làm nổi phần liên quan và làm mờ phần còn
  // lại — với vài trăm nút thì đây là cách duy nhất đọc được một vùng cụ thể.
  const focusId = hovered || selected?.id || null
  const neighbours = useMemo(() => {
    if (!focusId || !data) return null
    const set = new Set<string>([focusId])
    for (const e of data.edges) {
      if (e.source === focusId) set.add(e.target)
      else if (e.target === focusId) set.add(e.source)
    }
    return set
  }, [focusId, data])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const node of data?.nodes || []) counts[node.type] = (counts[node.type] || 0) + 1
    return counts
  }, [data])

  const shouldLabel = useCallback(
    (node: ForceNode, globalScale: number) => {
      if (labelMode === 'none') return false
      // Dưới ngưỡng này, khoảng cách giữa các nút nhỏ hơn bề rộng một chữ, nên
      // bật nhãn chỉ tạo ra một đám mực. Người dùng phóng to là nhãn hiện lại.
      if (globalScale < MIN_LABEL_SCALE) return false
      if (labelMode === 'all') return true
      // "Nút chính": các thực thể tra cứu có nhãn sớm; tin tức và công ty đợi
      // tới khi phóng đủ gần.
      return KEY_TYPES.has(node.type) || globalScale > 1.8
    },
    [labelMode],
  )

  const paintNode = useCallback(
    (node: ForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const dimmed = neighbours ? !neighbours.has(node.id) : false
      const isFocus = node.id === focusId
      const radius = Math.max(3, node.size / 2)

      ctx.globalAlpha = dimmed ? 0.16 : 1

      ctx.beginPath()
      ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI)
      ctx.fillStyle = node.color
      ctx.fill()

      if (isFocus || selected?.id === node.id) {
        ctx.lineWidth = 2.5 / globalScale
        ctx.strokeStyle = node.color
        ctx.globalAlpha = 0.35
        ctx.beginPath()
        ctx.arc(node.x || 0, node.y || 0, radius + 3.5 / globalScale, 0, 2 * Math.PI)
        ctx.stroke()
        ctx.globalAlpha = dimmed ? 0.16 : 1
      }

      if (shouldLabel(node, globalScale) && !dimmed) {
        const maxLen = node.type === 'news' ? 32 : 26
        const label = node.label.length > maxLen ? `${node.label.slice(0, maxLen - 1)}…` : node.label
        const fontSize = Math.max(9, 11 / globalScale)
        ctx.font = `${isFocus ? 600 : 400} ${fontSize}px "IBM Plex Sans", system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'

        const y = (node.y || 0) + radius + 2 / globalScale

        // Nền chữ mờ: không có nó, nhãn nằm đè lên cạnh sẽ không đọc được.
        const w = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(255,255,255,0.72)'
        ctx.fillRect((node.x || 0) - w / 2 - 1.5 / globalScale, y - 0.5 / globalScale, w + 3 / globalScale, fontSize * 1.12)

        ctx.fillStyle = isFocus ? '#0f172a' : 'rgba(51,65,85,0.92)'
        ctx.fillText(label, node.x || 0, y)
      }

      ctx.globalAlpha = 1
    },
    [neighbours, focusId, selected, shouldLabel],
  )

  const isEmpty = !loading && (data?.nodes.length || 0) === 0

  return (
    <div className="p-4 sm:p-6 fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('graph.title')}
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {t('graph.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border-subtle)' }}
            role="group"
            aria-label={t('graph.viewModeGroup')}
          >
            {(['2d', '3d'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className="px-3 py-2 text-[12px] font-medium transition-colors flex items-center gap-1.5"
                style={{
                  background: mode === m ? 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' : 'var(--bg-card)',
                  color: mode === m ? 'white' : 'var(--text-secondary)',
                }}
              >
                {m === '2d' ? <Boxes size={13} /> : <Rotate3d size={13} />}
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => graphRef.current?.zoomToFit?.(600, 60)}
            aria-label={t('graph.zoomToFit')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <Maximize2 size={13} />
            {t('graph.zoomToFitButton')}
          </button>

          <button
            onClick={load}
            aria-label={t('graph.reload')}
            className="p-2 rounded-xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Bộ lọc + mức nhãn */}
      <div
        className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Filter size={14} style={{ color: 'var(--text-faint)' }} />
          <input
            className="field-input flex-1"
            placeholder={t('graph.filterInput.placeholder')}
            defaultValue={stockFilter}
            onBlur={(e) => setFilter('stock', e.target.value.trim().toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setFilter('stock', (e.target as HTMLInputElement).value.trim().toUpperCase())
            }}
            aria-label={t('graph.filterInput.ariaLabel')}
          />
        </div>

        <select
          className="field-input w-full sm:w-48"
          value={industryFilter}
          onChange={(e) => setFilter('industry', e.target.value)}
          aria-label={t('graph.industryFilter.ariaLabel')}
        >
          <option value="">{t('graph.industryFilter.allOption')}</option>
          {industries.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <Type size={13} style={{ color: 'var(--text-faint)' }} />
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }} role="group" aria-label={t('graph.labelModeGroup')}>
            {LABEL_MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setLabelMode(m.key)}
                aria-pressed={labelMode === m.key}
                title={m.hint}
                className="px-2.5 py-1.5 text-[11px] transition-colors"
                style={{
                  background: labelMode === m.key ? 'rgba(37,99,235,0.14)' : 'transparent',
                  color: labelMode === m.key ? '#2563eb' : 'var(--text-muted)',
                  fontWeight: labelMode === m.key ? 600 : 400,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {(stockFilter || industryFilter) && (
          <button
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
            className="px-3 py-2 rounded-xl text-[12px]"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
          >
            {t('graph.clearFilters')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div
          ref={containerRef}
          className="rounded-2xl overflow-hidden relative"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            height: 'min(66vh, 600px)',
          }}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-8 h-8 rounded-full skeleton" />
            </div>
          )}

          {isEmpty ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <Boxes size={30} style={{ color: 'var(--text-faint)' }} />
              <p className="mt-3 text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
                {t('graph.empty.title')}
              </p>
              <p className="mt-1 text-[12px] max-w-sm" style={{ color: 'var(--text-muted)' }}>
                {stockFilter || industryFilter
                  ? t('graph.empty.filtered')
                  : t('graph.empty.none')}
              </p>
              <Link
                to="/import"
                className="mt-4 px-4 py-2 rounded-xl text-[13px] font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
              >
                {t('graph.empty.importData')}
              </Link>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full skeleton" />
                </div>
              }
            >
              {mode === '2d' ? (
                <ForceGraph2D
                  ref={graphRef as never}
                  graphData={graphData as never}
                  width={size.width}
                  height={size.height}
                  backgroundColor="rgba(0,0,0,0)"
                  nodeCanvasObject={paintNode as never}
                  nodePointerAreaPaint={((node: ForceNode, color: string, ctx: CanvasRenderingContext2D) => {
                    ctx.beginPath()
                    ctx.arc(node.x || 0, node.y || 0, Math.max(5, node.size / 2 + 2), 0, 2 * Math.PI)
                    ctx.fillStyle = color
                    ctx.fill()
                  }) as never}
                  linkColor={((link: { source: ForceNode | string; target: ForceNode | string }) => {
                    if (!neighbours) return 'rgba(148,163,184,0.35)'
                    const s = typeof link.source === 'object' ? link.source.id : link.source
                    const t = typeof link.target === 'object' ? link.target.id : link.target
                    return neighbours.has(s) && neighbours.has(t)
                      ? 'rgba(37,99,235,0.55)'
                      : 'rgba(148,163,184,0.08)'
                  }) as never}
                  linkDirectionalArrowLength={3}
                  linkDirectionalArrowRelPos={1}
                  onNodeClick={((node: ForceNode) => setSelected(node)) as never}
                  onNodeHover={((node: ForceNode | null) => setHovered(node?.id || null)) as never}
                  onEngineStop={(() => graphRef.current?.zoomToFit?.(700, 70)) as never}
                  d3VelocityDecay={0.28}
                  nodeRelSize={5}
                  cooldownTicks={140}
                />
              ) : (
                <ForceGraph3D
                  ref={graphRef as never}
                  graphData={graphData as never}
                  width={size.width}
                  height={size.height}
                  backgroundColor="rgba(0,0,0,0)"
                  nodeLabel={((node: ForceNode) =>
                    `${NODE_TYPE_LABELS[node.type] || node.type}: ${node.label}`) as never}
                  nodeColor={((node: ForceNode) =>
                    neighbours && !neighbours.has(node.id) ? 'rgba(148,163,184,0.25)' : node.color) as never}
                  nodeVal={((node: ForceNode) => node.size) as never}
                  // Nhãn nổi trong không gian 3D. Không có nó, chế độ 3D chỉ là
                  // một đám cầu màu và người dùng phải rê từng nút mới biết tên.
                  nodeThreeObjectExtend
                  nodeThreeObject={((node: ForceNode) => {
                    if (labelMode === 'none') return null
                    if (labelMode === 'key' && !KEY_TYPES.has(node.type)) return null
                    if (!SpriteText) return null
                    const maxLen = node.type === 'news' ? 30 : 24
                    const text = node.label.length > maxLen ? `${node.label.slice(0, maxLen - 1)}…` : node.label
                    const sprite = new SpriteText(text)
                    sprite.color = neighbours && !neighbours.has(node.id) ? 'rgba(148,163,184,0.28)' : '#1e293b'
                    // Cỡ chữ phải đủ lớn so với khoảng cách camera mặc định của
                    // react-force-graph-3d; 3.2 vẽ ra chữ khoảng 2px trên màn
                    // hình, tức không đọc được. Nút quan trọng hơn thì chữ to hơn.
                    sprite.textHeight = node.size > 12 ? 7 : 5.5
                    sprite.position.y = -(Math.max(3, node.size / 2) + 5)
                    sprite.material.depthWrite = false
                    return sprite
                  }) as never}
                  linkColor={((link: { source: ForceNode | string; target: ForceNode | string }) => {
                    if (!neighbours) return 'rgba(148,163,184,0.4)'
                    const s = typeof link.source === 'object' ? link.source.id : link.source
                    const t = typeof link.target === 'object' ? link.target.id : link.target
                    return neighbours.has(s) && neighbours.has(t) ? 'rgba(37,99,235,0.7)' : 'rgba(148,163,184,0.06)'
                  }) as never}
                  linkDirectionalArrowLength={3}
                  linkDirectionalArrowRelPos={1}
                  onNodeClick={((node: ForceNode) => setSelected(node)) as never}
                  onNodeHover={((node: ForceNode | null) => setHovered(node?.id || null)) as never}
                />
              )}
            </Suspense>
          )}
        </div>

        {/* Bảng bên */}
        <div className="space-y-3">
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-[13px] font-semibold mb-2.5" style={{ color: 'var(--text-primary)' }}>
              {t('graph.legendCard.title')}
            </h3>
            <Legend counts={typeCounts} labels={NODE_TYPE_LABELS} />
            {data?.metadata && (
              <p className="text-[11px] mt-3 pt-2.5" style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border-subtle)' }}>
                {t('graph.legendCard.summary', { shown: data.nodes.length, total: data.metadata.total_nodes, edges: data.edges.length })}
              </p>
            )}
          </div>

          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {selected ? t('graph.detailCard.selectedTitle') : t('graph.detailCard.defaultTitle')}
            </h3>
            {selected ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                    style={{ background: selected.color }}
                  />
                  <div className="min-w-0">
                    <span className="text-[14px] font-semibold block" style={{ color: 'var(--text-primary)' }}>
                      {String(selected.properties?.full_name || selected.properties?.title || selected.label)}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {NODE_TYPE_LABELS[selected.type] || selected.type}
                    </span>
                  </div>
                </div>

                {selected.type === 'stock' && (
                  <>
                    {selected.properties?.company && (
                      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {String(selected.properties.company)}
                      </p>
                    )}
                    {selected.properties?.industry && (
                      <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                        {t('graph.detailCard.industryLabel', { industry: String(selected.properties.industry) })}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <SymbolChip symbol={selected.id} />
                      <button
                        onClick={() => setFilter('stock', selected.id)}
                        className="text-[11px] px-2 py-0.5 rounded"
                        style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
                      >
                        {t('graph.detailCard.filterHere')}
                      </button>
                    </div>
                  </>
                )}

                {selected.type === 'news' && (
                  <Link
                    to="/feed"
                    className="inline-flex items-center gap-1.5 text-[11px] hover:underline"
                    style={{ color: '#2563eb' }}
                  >
                    <Newspaper size={11} /> {t('graph.detailCard.viewInFeed')}
                  </Link>
                )}

                {selected.type === 'industry' && (
                  <button
                    onClick={() => setFilter('industry', selected.label)}
                    className="w-full mt-1 px-3 py-2 rounded-xl text-[12px] font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
                  >
                    {t('graph.detailCard.filterIndustry', { industry: selected.label })}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {t('graph.detailCard.hint')}
              </p>
            )}
          </div>

          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-start gap-2">
              <Info size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
              <div>
                <h3 className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {t('graph.helpCard.title')}
                </h3>
                <ul className="text-[11px] space-y-1" style={{ color: 'var(--text-muted)' }}>
                  <li>{t('graph.helpCard.line1')}</li>
                  <li>{t('graph.helpCard.line2')}</li>
                  <li>{t('graph.helpCard.line3')}</li>
                  <li>{t('graph.helpCard.relationsLine', { relations: Object.values(RELATION_LABELS).slice(0, 4).join(', ') })}</li>
                </ul>
                <p className="text-[11px] mt-2" style={{ color: 'var(--text-faint)' }}>
                  {t('graph.helpCard.disclaimerPrefix')} <strong>{t('graph.helpCard.disclaimerNot')}</strong>{' '}
                  {t('graph.helpCard.disclaimerMiddle')} <strong>{t('graph.helpCard.disclaimerPurpose')}</strong>
                  {t('graph.helpCard.disclaimerEnd')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
