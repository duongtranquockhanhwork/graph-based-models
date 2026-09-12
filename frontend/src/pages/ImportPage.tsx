import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { useAnalysisJobs } from '../context/AnalysisJobsContext'
import {
  Upload, FileText, Plus, RefreshCw, Link2, CheckCircle2,
  AlertCircle, Loader2, Globe
} from 'lucide-react'
import { newsApi } from '../services/api'

type Tab = 'csv' | 'url' | 'manual'

export default function ImportPage() {
  const { track } = useAnalysisJobs()
  const [activeTab, setActiveTab] = useState<Tab>('csv')

  // CSV state
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<number | null>(null)

  // URL state
  const [urlInput, setUrlInput] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlPreview, setUrlPreview] = useState<{ title: string; source: string } | null>(null)

  // Manual state
  const [form, setForm] = useState({ title: '', content: '', source: '', published_date: '' })
  const [submitting, setSubmitting] = useState(false)

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return
    setUploading(true)
    setUploadResult(null)
    try {
      const res = await newsApi.uploadCsv(files[0])
      const ids: number[] = res.data.ids
      setUploadResult(ids.length)
      toast.success(`Đã nhập ${ids.length} bài báo. Đang phân tích…`)
      // Phân tích chạy nền; theo dõi để báo và trỏ tới kết quả khi xong.
      track(ids, `${ids.length} bài từ CSV`)
    } catch {
      toast.error('Lỗi khi upload file CSV')
    } finally {
      setUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  })

  const handleUrlImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return
    setUrlLoading(true)
    setUrlPreview(null)
    try {
      const res = await newsApi.importUrl(urlInput.trim())
      setUrlPreview({ title: res.data.title, source: res.data.source })
      toast.success('Đã nhập bài báo. Đang phân tích…')
      track([res.data.id], res.data.title)
      setUrlInput('')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Không thể import URL này'
      toast.error(msg)
    } finally {
      setUrlLoading(false)
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true)
    try {
      const res = await newsApi.create(form)
      toast.success('Đã thêm bài báo. Đang phân tích…')
      track([res.data.id], form.title)
      setForm({ title: '', content: '', source: '', published_date: '' })
    } catch {
      toast.error('Lỗi khi thêm bài báo')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAnalyzeAll = async () => {
    try {
      await newsApi.analyzeAll()
      toast.success('Đã xếp hàng phân tích tất cả bài báo')
    } catch {
      toast.error('Lỗi khi phân tích')
    }
  }

  const TABS: { key: Tab; icon: React.ElementType; label: string; desc: string }[] = [
    { key: 'csv', icon: FileText, label: 'Upload CSV', desc: 'Import nhiều bài cùng lúc' },
    { key: 'url', icon: Link2, label: 'Từ URL', desc: 'Scrape từ website tin tức' },
    { key: 'manual', icon: Plus, label: 'Thủ công', desc: 'Nhập nội dung trực tiếp' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Nhập dữ liệu tin tức</h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Thêm dữ liệu để hệ thống phân tích và xây dựng Knowledge Graph
          </p>
        </div>
        <button
          onClick={handleAnalyzeAll}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all"
          style={{
            background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.25)',
            color: '#10b981',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.2)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.12)'
          }}
        >
          <RefreshCw size={14} />
          Phân tích tất cả
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-2xl mb-6"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        {TABS.map(({ key, icon: Icon, label, desc }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl text-left transition-all duration-200"
            style={
              activeTab === key
                ? {
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                  }
                : { border: '1px solid transparent' }
            }
          >
            <Icon
              size={15}
              style={{ color: activeTab === key ? '#60a5fa' : 'var(--text-faint)', flexShrink: 0 }}
            />
            <div className="min-w-0">
              <p
                className="text-[13px] font-medium leading-tight"
                style={{ color: activeTab === key ? 'var(--text-primary)' : 'var(--text-muted)' }}
              >
                {label}
              </p>
              <p className="text-[10px] leading-tight mt-0.5 hidden sm:block" style={{ color: 'var(--text-faint)' }}>
                {desc}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* CSV Tab */}
      {activeTab === 'csv' && (
        <div
          className="rounded-2xl p-6 card-glow"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            {...getRootProps()}
            className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200"
            style={{
              borderColor: isDragActive ? '#3b82f6' : 'var(--border-default)',
              background: isDragActive ? 'rgba(37,99,235,0.06)' : 'transparent',
            }}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={36} className="text-blue-400 animate-spin" />
                <p className="text-blue-400 text-sm">Đang xử lý file...</p>
              </div>
            ) : isDragActive ? (
              <div className="flex flex-col items-center gap-3">
                <Upload size={36} style={{ color: '#3b82f6' }} />
                <p className="text-blue-400 text-sm font-medium">Thả file vào đây</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)' }}
                >
                  <Upload size={24} style={{ color: '#3b82f6' }} />
                </div>
                <div>
                  <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>Kéo thả file CSV vào đây</p>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    hoặc click để chọn file từ máy tính
                  </p>
                </div>
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]"
                  style={{ background: 'rgba(37,99,235,0.08)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.15)' }}
                >
                  Cột bắt buộc: <strong>title</strong> · Tuỳ chọn: content, source, published_date, url
                </div>
              </div>
            )}
          </div>

          {uploadResult !== null && (
            <div
              className="mt-4 flex items-center gap-2.5 p-3 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
              <p className="text-green-400 text-[13px]">
                Đã import thành công <strong>{uploadResult}</strong> bài báo
              </p>
            </div>
          )}

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <a
              href="/sample_news.csv"
              className="inline-flex items-center gap-1.5 text-[12px] transition-colors"
              style={{ color: '#60a5fa' }}
            >
              <FileText size={13} />
              Tải file CSV mẫu
            </a>
          </div>
        </div>
      )}

      {/* URL Tab */}
      {activeTab === 'url' && (
        <div
          className="rounded-2xl p-6 card-glow"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-start gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}
            >
              <Globe size={18} style={{ color: '#0ea5e9' }} />
            </div>
            <div>
              <h3 className="font-semibold text-[14px]" style={{ color: 'var(--text-primary)' }}>Import từ URL tin tức</h3>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Nhập link bài báo từ các website chứng khoán VN (cafef.vn, vnexpress.net, vietstock.vn...)
              </p>
            </div>
          </div>

          <form onSubmit={handleUrlImport} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                URL bài báo
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
                  <input
                    className="field-input pl-9"
                    placeholder="https://cafef.vn/..."
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    type="url"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={urlLoading || !urlInput.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-medium transition-all disabled:opacity-50 flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)', color: 'white' }}
                >
                  {urlLoading ? (
                    <><Loader2 size={14} className="animate-spin" /> Đang lấy...</>
                  ) : (
                    <><Globe size={14} /> Import</>
                  )}
                </button>
              </div>
            </div>
          </form>

          {urlPreview && (
            <div
              className="mt-4 p-4 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-green-400 text-[12px] font-medium mb-1">Import thành công!</p>
                  <p className="text-[13px] font-medium line-clamp-2" style={{ color: 'var(--text-primary)' }}>{urlPreview.title}</p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>
                    Nguồn: {urlPreview.source} · Đang phân tích NLP...
                  </p>
                </div>
              </div>
            </div>
          )}

          <div
            className="mt-5 p-4 rounded-xl"
            style={{ background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.12)' }}
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[12px] font-medium" style={{ color: '#60a5fa' }}>
                  Website hỗ trợ tốt:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {['cafef.vn', 'vnexpress.net', 'vietstock.vn', 'tinnhanhchungkhoan.vn', 'ndh.vn', 'baomoi.com'].map(site => (
                    <span
                      key={site}
                      className="px-2 py-0.5 rounded text-[11px]"
                      style={{ background: 'rgba(37,99,235,0.1)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.15)' }}
                    >
                      {site}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Tab */}
      {activeTab === 'manual' && (
        <div
          className="rounded-2xl p-6 card-glow"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Tiêu đề bài báo <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                className="field-input"
                placeholder="VD: FPT báo lãi quý II tăng 25% so với cùng kỳ..."
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Nội dung
              </label>
              <textarea
                className="field-input resize-none"
                rows={5}
                placeholder="Nội dung chi tiết bài báo..."
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Nguồn
                </label>
                <input
                  className="field-input"
                  placeholder="cafef.vn"
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Ngày đăng
                </label>
                <input
                  type="date"
                  className="field-input"
                  value={form.published_date}
                  onChange={e => setForm(f => ({ ...f, published_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !form.title.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-medium transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)', color: 'white' }}
              >
                {submitting ? (
                  <><Loader2 size={14} className="animate-spin" /> Đang lưu...</>
                ) : (
                  <><Plus size={14} /> Thêm bài báo</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
