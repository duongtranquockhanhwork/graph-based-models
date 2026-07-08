import { useEffect, useRef, useState, useCallback } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import { graphApi } from '../services/api'
import type { GraphData, GraphNode } from '../types'
import { Search, RefreshCw, Info } from 'lucide-react'

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
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [], metadata: {} })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<FGNode | null>(null)

  const loadGraph = useCallback(async (stockFilter?: string) => {
    setLoading(true)
    try {
      const res = await graphApi.get(stockFilter ? { stock: stockFilter, limit: 150 } : { limit: 200 })
      setGraphData(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadGraph() }, [loadGraph])

  const fgNodes = graphData.nodes.map(n => ({ ...n }))
  const fgLinks = graphData.edges.map(e => ({ source: e.source, target: e.target, label: e.relation }))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) loadGraph(search.trim().toUpperCase())
    else loadGraph()
  }

  return (
    <div className="flex h-full relative" style={{ background: '#030712' }}>
      {/* Top controls */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: '#3d5a7a' }}
            />
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
                backdropFilter: 'blur(12px)',
                width: 200,
              }}
              placeholder="Lọc mã: FPT, VNM..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            type="submit"
            style={{
              background: 'rgba(37,99,235,0.9)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '8px 14px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Lọc
          </button>
          <button
            type="button"
            onClick={() => { setSearch(''); loadGraph() }}
            style={{
              background: 'rgba(7,17,31,0.9)',
              color: '#94a3b8',
              border: '1px solid #1e3556',
              borderRadius: 10,
              padding: '8px 14px',
              fontSize: 13,
              cursor: 'pointer',
              backdropFilter: 'blur(12px)',
            }}
          >
            Reset
          </button>
        </form>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: '#030712' }}>
          <div className="text-center">
            <RefreshCw className="animate-spin mx-auto mb-3" size={28} style={{ color: '#3b82f6' }} />
            <p className="text-[13px]" style={{ color: '#475569' }}>Đang xây dựng Knowledge Graph 3D...</p>
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

      {/* 3D Graph */}
      {!loading && graphData.nodes.length > 0 && (
        <ForceGraph3D
          ref={fgRef}
          graphData={{ nodes: fgNodes, links: fgLinks }}
          nodeLabel="label"
          nodeColor={(n: object) => NODE_COLORS[(n as FGNode).type] || '#666'}
          nodeVal={(n: object) => Math.max((n as FGNode).size || 5, 3)}
          linkLabel="label"
          linkColor={() => 'rgba(30,53,86,0.6)'}
          linkWidth={0.8}
          backgroundColor="#030712"
          onNodeClick={(node: object) => setSelected(node as FGNode)}
          width={window.innerWidth - (selected ? 288 : 0) - 240}
          height={window.innerHeight}
        />
      )}

      {/* Legend */}
      <div
        className="absolute bottom-4 left-4 z-20 rounded-2xl p-3"
        style={{
          background: 'rgba(7,17,31,0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #1e3556',
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#3d5a7a' }}>
          Chú thích
        </p>
        <div className="space-y-1.5">
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: color, boxShadow: `0 0 5px ${color}60` }}
              />
              <span className="text-[11px]" style={{ color: '#64748b' }}>
                {NODE_TYPE_LABELS[type]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div
        className="absolute bottom-4 right-4 z-20 rounded-2xl px-4 py-3 text-right"
        style={{
          background: 'rgba(7,17,31,0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #1e3556',
        }}
      >
        <p className="text-[12px] font-medium text-white">
          {(graphData.metadata?.total_nodes || 0).toLocaleString()} nodes
          <span style={{ color: '#1e3556' }}> · </span>
          {(graphData.metadata?.total_edges || 0).toLocaleString()} edges
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: '#3d5a7a' }}>
          Kéo để xoay · Scroll để zoom · Click để xem
        </p>
      </div>

      {/* Node detail panel */}
      {selected && (
        <div
          className="absolute right-0 top-0 bottom-0 w-72 p-5 overflow-y-auto z-20"
          style={{
            background: 'rgba(7,17,31,0.96)',
            backdropFilter: 'blur(16px)',
            borderLeft: '1px solid #1e3556',
          }}
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
  )
}
