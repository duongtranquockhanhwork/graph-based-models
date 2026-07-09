import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import ForceGraph2D from 'react-force-graph-2d'
import SpriteText from 'three-spritetext'
import { graphApi } from '../services/api'
import type { GraphData } from '../types'
import { Search, RefreshCw, Info, Box, CircleDot } from 'lucide-react'

const NODE_COLORS: Record<string, string> = {
  news: '#3B82F6',
  stock: '#10B981',
  company: '#8B5CF6',
  industry: '#F59E0B',
  event: '#EF4444',
  sentiment: '#F97316',
}
const NODE_TYPE_LABELS: Record<string, string> = {
  news: 'Tin tức',
  stock: 'Cổ phiếu',
  company: 'Công ty',
  industry: 'Ngành',
  event: 'Sự kiện',
  sentiment: 'Sentiment',
}

interface FGNode {
  id: string
  label: string
  type: string
  color: string
  size: number
  properties: Record<string, string>
  x?: number
  y?: number
  z?: number
}

export default function GraphPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [], metadata: {} })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeStock, setActiveStock] = useState<string | null>(null)
  const [selected, setSelected] = useState<FGNode | null>(null)

  const loadGraph = useCallback(async (stockFilter?: string) => {
    setLoading(true)
    try {
      const res = await graphApi.get(stockFilter ? { stock: stockFilter, limit: 150 } : { limit: 200 })
      setGraphData(res.data)
      setActiveStock(stockFilter || null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadGraph() }, [loadGraph])

  const fgNodes = graphData.nodes.map(n => ({ ...n }))
  const fgLinks = graphData.edges.map(e => ({ source: e.source, target: e.target, label: e.relation }))

  // Mã cổ phiếu nổi bật nhất (nhiều liên kết nhất) để gợi ý lọc nhanh
  const topStocks = useMemo(() => {
    return graphData.nodes
      .filter(n => n.type === 'stock')
      .sort((a, b) => b.size - a.size)
      .slice(0, 8)
      .map(n => n.id)
  }, [graphData.nodes])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) loadGraph(search.trim().toUpperCase())
    else loadGraph()
  }

  const handleChipClick = (symbol: string) => {
    setSearch(symbol)
    loadGraph(symbol)
  }

  const handleReset = () => {
    setSearch('')
    loadGraph()
  }

  const graphWidth = window.innerWidth - (selected ? 288 : 0) - 240
  const graphHeight = window.innerHeight - 96

  return (
    <div className="flex flex-col h-full" style={{ background: '#030712' }}>
      {/* Top toolbar */}
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #1a2d4a', background: 'rgba(7,17,31,0.6)' }}
      >
        {/* 2D / 3D tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: '#0a1628', border: '1px solid #1e3556' }}>
          <button
            type="button"
            onClick={() => setViewMode('2d')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
            style={
              viewMode === '2d'
                ? { background: '#2563eb', color: 'white' }
                : { color: '#64748b' }
            }
          >
            <CircleDot size={13} /> 2D · Dễ nhìn
          </button>
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
            style={
              viewMode === '3d'
                ? { background: '#2563eb', color: 'white' }
                : { color: '#64748b' }
            }
          >
            <Box size={13} /> 3D · Trực quan
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#3d5a7a' }} />
            <input
              style={{
                background: 'rgba(7,17,31,0.92)',
                border: '1px solid #1e3556',
                borderRadius: 10,
                paddingLeft: 32,
                paddingRight: 14,
                paddingTop: 8,
                paddingBottom: 8,
                color: '#e2e8f0',
                fontSize: 13,
                outline: 'none',
                width: 180,
              }}
              placeholder="Lọc mã: FPT, VNM..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            type="submit"
            style={{
              background: 'rgba(37,99,235,0.9)', color: 'white', border: 'none',
              borderRadius: 10, padding: '8px 14px', fontSize: 13, cursor: 'pointer',
            }}
          >
            Lọc
          </button>
          {activeStock && (
            <button
              type="button"
              onClick={handleReset}
              style={{
                background: 'rgba(7,17,31,0.9)', color: '#94a3b8', border: '1px solid #1e3556',
                borderRadius: 10, padding: '8px 14px', fontSize: 13, cursor: 'pointer',
              }}
            >
              Xem tất cả
            </button>
          )}
        </form>

        {/* Gợi ý chọn nhanh mã cổ phiếu phổ biến */}
        {topStocks.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px]" style={{ color: '#3d5a7a' }}>Xem nhanh:</span>
            {topStocks.map(symbol => (
              <button
                key={symbol}
                type="button"
                onClick={() => handleChipClick(symbol)}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors"
                style={
                  activeStock === symbol
                    ? { background: 'rgba(37,99,235,0.25)', color: '#93c5fd', border: '1px solid rgba(37,99,235,0.5)' }
                    : { background: 'rgba(16,185,129,0.08)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.2)' }
                }
              >
                {symbol}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hướng dẫn đọc đồ thị */}
      <div
        className="flex items-start gap-2 px-5 py-2.5 flex-shrink-0 text-[12px]"
        style={{ background: 'rgba(37,99,235,0.06)', borderBottom: '1px solid #1a2d4a', color: '#93a8c4' }}
      >
        <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#3b82f6' }} />
        <span>
          Mỗi <b style={{ color: '#e2e8f0' }}>chấm tròn</b> là một tin tức, cổ phiếu, công ty... (màu sắc = loại, xem chú thích) —
          <b style={{ color: '#e2e8f0' }}> đường nối</b> thể hiện mối quan hệ giữa chúng. Chấm càng lớn = càng nhiều liên kết.
          Bấm vào một mã cổ phiếu ở trên để chỉ xem các quan hệ liên quan đến nó, hoặc click vào một chấm để xem chi tiết.
        </span>
      </div>

      <div className="flex-1 relative">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: '#030712' }}>
            <div className="text-center">
              <RefreshCw className="animate-spin mx-auto mb-3" size={28} style={{ color: '#3b82f6' }} />
              <p className="text-[13px]" style={{ color: '#475569' }}>Đang xây dựng Knowledge Graph...</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && graphData.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <Info size={36} className="mx-auto mb-3" style={{ color: '#1e3556' }} />
              <p className="text-[15px] font-medium" style={{ color: '#475569' }}>Chưa có dữ liệu graph</p>
              <p className="text-[13px] mt-1" style={{ color: '#334155' }}>Hãy import và phân tích tin tức trước</p>
            </div>
          </div>
        )}

        {/* Graph */}
        {!loading && graphData.nodes.length > 0 && viewMode === '3d' && (
          <ForceGraph3D
            ref={fgRef}
            graphData={{ nodes: fgNodes, links: fgLinks }}
            nodeLabel="label"
            nodeColor={(n: object) => NODE_COLORS[(n as FGNode).type] || '#666'}
            nodeVal={(n: object) => Math.max((n as FGNode).size || 5, 3)}
            nodeThreeObjectExtend
            nodeThreeObject={(n: object) => {
              const node = n as FGNode
              const sprite = new SpriteText(node.label)
              sprite.color = '#cbd5e1'
              sprite.textHeight = 2.6
              sprite.position.set(0, Math.max(node.size || 5, 3) + 2.5, 0)
              return sprite
            }}
            linkLabel="label"
            linkColor={() => 'rgba(30,53,86,0.6)'}
            linkWidth={0.8}
            backgroundColor="#030712"
            onNodeClick={(node: object) => setSelected(node as FGNode)}
            width={graphWidth}
            height={graphHeight}
          />
        )}

        {!loading && graphData.nodes.length > 0 && viewMode === '2d' && (
          <ForceGraph2D
            ref={fgRef}
            graphData={{ nodes: fgNodes, links: fgLinks }}
            nodeLabel="label"
            nodeColor={(n: object) => NODE_COLORS[(n as FGNode).type] || '#666'}
            nodeVal={(n: object) => Math.max((n as FGNode).size || 5, 3)}
            nodeCanvasObject={(n: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const node = n as FGNode & { x: number; y: number }
              const r = Math.max((node.size || 5) / 1.8, 3)
              ctx.beginPath()
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
              ctx.fillStyle = NODE_COLORS[node.type] || '#666'
              ctx.fill()

              const fontSize = Math.max(11 / globalScale, 3)
              ctx.font = `${fontSize}px sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.fillStyle = 'rgba(226,232,240,0.9)'
              ctx.fillText(node.label, node.x, node.y + r + 1.5)
            }}
            nodePointerAreaPaint={(n: object, color: string, ctx: CanvasRenderingContext2D) => {
              const node = n as FGNode & { x: number; y: number }
              const r = Math.max((node.size || 5) / 1.8, 3)
              ctx.fillStyle = color
              ctx.beginPath()
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
              ctx.fill()
            }}
            linkLabel="label"
            linkColor={() => 'rgba(30,53,86,0.8)'}
            linkWidth={1}
            backgroundColor="#030712"
            onNodeClick={(node: object) => setSelected(node as FGNode)}
            width={graphWidth}
            height={graphHeight}
            cooldownTicks={100}
          />
        )}

        {/* Legend */}
        <div
          className="absolute bottom-4 left-4 z-20 rounded-2xl p-3"
          style={{ background: 'rgba(7,17,31,0.92)', backdropFilter: 'blur(12px)', border: '1px solid #1e3556' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#3d5a7a' }}>
            Chú thích
          </p>
          <div className="space-y-1.5">
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 5px ${color}60` }} />
                <span className="text-[11px]" style={{ color: '#64748b' }}>{NODE_TYPE_LABELS[type]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div
          className="absolute bottom-4 right-4 z-20 rounded-2xl px-4 py-3 text-right"
          style={{ background: 'rgba(7,17,31,0.92)', backdropFilter: 'blur(12px)', border: '1px solid #1e3556' }}
        >
          <p className="text-[12px] font-medium text-white">
            {(graphData.metadata?.total_nodes || 0).toLocaleString()} nodes
            <span style={{ color: '#1e3556' }}> · </span>
            {(graphData.metadata?.total_edges || 0).toLocaleString()} edges
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: '#3d5a7a' }}>
            {viewMode === '3d' ? 'Kéo để xoay · Scroll để zoom · Click để xem' : 'Kéo để di chuyển · Scroll để zoom · Click để xem'}
          </p>
        </div>

        {/* Node detail panel */}
        {selected && (
          <div
            className="absolute right-0 top-0 bottom-0 w-72 p-5 overflow-y-auto z-20"
            style={{ background: 'rgba(7,17,31,0.96)', backdropFilter: 'blur(16px)', borderLeft: '1px solid #1e3556' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-[14px]">Chi tiết node</h3>
              <button
                onClick={() => setSelected(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                style={{ color: '#475569', background: '#1e3556' }}
              >
                ×
              </button>
            </div>

            <div
              className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center text-white font-bold text-lg"
              style={{
                background: NODE_COLORS[selected.type] || '#666',
                boxShadow: `0 0 20px ${NODE_COLORS[selected.type] || '#666'}50`,
              }}
            >
              {selected.type[0].toUpperCase()}
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#3d5a7a' }}>Nhãn</p>
                <p className="text-white text-[13px] font-medium">{selected.label}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#3d5a7a' }}>Loại</p>
                <span
                  className="text-[11px] px-2.5 py-1 rounded-lg text-white font-medium"
                  style={{ background: NODE_COLORS[selected.type] || '#666' }}
                >
                  {NODE_TYPE_LABELS[selected.type] || selected.type}
                </span>
              </div>
              {Object.entries(selected.properties || {}).map(([k, v]) =>
                v ? (
                  <div key={k}>
                    <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#3d5a7a' }}>{k}</p>
                    <p className="text-[12px]" style={{ color: '#94a3b8' }}>{String(v)}</p>
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
