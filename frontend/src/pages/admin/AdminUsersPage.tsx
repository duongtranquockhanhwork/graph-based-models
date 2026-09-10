import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Search } from 'lucide-react'
import adminApi from '../../services/adminApi'
import type { AdminUser } from '../../types'
import { SkeletonBlock } from '../../components/Admin/AdminWidgets'
import { useAuth } from '../../context/AuthContext'

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = (query?: string) => {
    setLoading(true)
    adminApi.users.list(query).then((r) => setUsers(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => load(), [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(q || undefined)
  }

  const updateRole = async (u: AdminUser, role: string) => {
    try {
      await adminApi.users.update(u.id, { role })
      toast.success('Đã cập nhật vai trò')
      load(q || undefined)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Không thể cập nhật'
      toast.error(msg)
    }
  }

  const toggleActive = async (u: AdminUser) => {
    try {
      await adminApi.users.update(u.id, { is_active: !u.is_active })
      toast.success('Đã cập nhật trạng thái')
      load(q || undefined)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Không thể cập nhật'
      toast.error(msg)
    }
  }

  return (
    <div className="p-6 space-y-4 fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Quản lý người dùng</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{users.length} tài khoản</p>
      </div>

      <form onSubmit={handleSearch} className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
        <input className="field-input pl-9" placeholder="Tìm theo email hoặc tên..." value={q} onChange={(e) => setQ(e.target.value)} />
      </form>

      {loading ? (
        <SkeletonBlock className="h-64" />
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['ID', 'Email', 'Họ tên', 'Vai trò', 'Trạng thái', 'Ngày tạo'].map((h) => (
                    <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>{u.id}</td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text-primary)' }}>{u.email}</td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>{u.full_name || '—'}</td>
                    <td className="px-3 py-2.5">
                      <select
                        className="field-input w-32"
                        value={u.role}
                        disabled={u.id === currentUser?.id}
                        onChange={(e) => updateRole(u, e.target.value)}
                      >
                        <option value="customer">customer</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={u.id === currentUser?.id}
                        className="px-2.5 py-1 rounded-full text-[11px] disabled:opacity-50"
                        style={
                          u.is_active
                            ? { background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }
                            : { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }
                        }
                      >
                        {u.is_active ? 'Hoạt động' : 'Đã khoá'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
