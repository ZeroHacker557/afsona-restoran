import { useMemo, useState } from 'react'
import { MessageCircle, Phone, Search, Send } from 'lucide-react'
import { useAdminData } from '../lib/data-context'
import { adminPost } from '../lib/api'
import { Modal } from '../components/Modal'
import { Empty, Field, RowsSkeleton, Spinner } from '../components/ui'
import { toast, toastError } from '../lib/toast'
import { initials, money, timeAgo } from '../lib/format'
import type { AdminUser } from '../lib/db'

const DEAD = new Set(['Bekor qilingan', 'Rad etildi'])

export function CustomersPage() {
  const { users, orders, loaded } = useAdminData()
  const [search, setSearch] = useState('')
  const [writing, setWriting] = useState<AdminUser | null>(null)

  const rows = useMemo(() => {
    const stats = new Map<number, { count: number; sum: number; last: string }>()
    orders.forEach((order) => {
      if (!order.userId || DEAD.has(order.status)) return
      const entry = stats.get(order.userId) || { count: 0, sum: 0, last: '' }
      entry.count += 1
      entry.sum += order.total
      if (!entry.last || (Date.parse(order.createdAt) || 0) > (Date.parse(entry.last) || 0)) {
        entry.last = order.createdAt
      }
      stats.set(order.userId, entry)
    })

    const needle = search.trim().toLowerCase()

    return users
      .map((user) => ({
        user,
        ...(stats.get(user.id) || { count: 0, sum: 0, last: '' }),
      }))
      .filter(({ user }) => {
        if (!needle) return true
        return (
          `${user.first_name} ${user.last_name}`.toLowerCase().includes(needle) ||
          (user.username || '').toLowerCase().includes(needle) ||
          (user.phone || '').includes(needle) ||
          String(user.id).includes(needle)
        )
      })
      .sort((a, b) => b.sum - a.sum || b.count - a.count)
  }, [users, orders, search])

  return (
    <>
      <div className="relative max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--faint)' }}
        />
        <input
          className="adm-input pl-9"
          placeholder="Ism, username, telefon yoki ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <div className="adm-card">
          {!loaded.users ? (
            <RowsSkeleton rows={6} />
          ) : (
            <Empty text="Mijoz topilmadi" />
          )}
        </div>
      ) : (
        <div className="adm-card adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Mijoz</th>
                <th>Telefon</th>
                <th>Buyurtmalar</th>
                <th>Umumiy summa</th>
                <th>Oxirgi faollik</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ user, count, sum }) => (
                <tr key={user.id} className="adm-row-hover">
                  <td>
                    <div className="flex items-center gap-3">
                      {user.photo_url ? (
                        <img className="adm-thumb" style={{ borderRadius: 999 }} src={user.photo_url} alt="" />
                      ) : (
                        <span
                          className="grid size-11 flex-shrink-0 place-items-center rounded-full text-sm font-extrabold"
                          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
                        >
                          {initials(`${user.first_name || ''} ${user.last_name || ''}`)}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-bold">
                          {user.first_name} {user.last_name}
                        </span>
                        <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                          {user.username ? `@${user.username}` : `ID ${user.id}`}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>
                    {user.phone ? (
                      <a
                        href={`tel:${user.phone.replace(/\s/g, '')}`}
                        className="flex items-center gap-1.5 font-semibold"
                        style={{ color: 'var(--brand)' }}
                      >
                        <Phone size={13} />
                        {user.phone}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--faint)' }}>—</span>
                    )}
                  </td>
                  <td className="font-semibold">{count}</td>
                  <td className="font-bold">{money(sum)}</td>
                  <td style={{ color: 'var(--muted)' }}>
                    {user.lastActive ? timeAgo(user.lastActive) : '—'}
                  </td>
                  <td>
                    <button
                      className="adm-icon-btn"
                      onClick={() => setWriting(user)}
                      title="Xabar yuborish"
                    >
                      <MessageCircle size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {writing && <MessageModal user={writing} onClose={() => setWriting(null)} />}
    </>
  )
}

function MessageModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function send() {
    if (!text.trim()) return toast('Xabar bo‘sh', 'error')
    setBusy(true)
    try {
      const result = await adminPost<{ ok: boolean; error?: string }>('notify.user', {
        userId: user.id,
        text: text.trim(),
      })
      if (result.ok) {
        toast('Xabar yuborildi')
        onClose()
      } else {
        toast(result.error || 'Mijozga yetib bormadi', 'error')
      }
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`${user.first_name || 'Mijoz'} ga xabar`}
      onClose={onClose}
      footer={
        <>
          <button className="adm-btn" onClick={onClose} disabled={busy}>
            Bekor
          </button>
          <button className="adm-btn primary" onClick={send} disabled={busy}>
            {busy ? <Spinner /> : <Send size={16} />}
            Yuborish
          </button>
        </>
      }
    >
      <Field label="Xabar" hint="Telegram orqali va ilova ichida ko'rinadi">
        <textarea
          className="adm-textarea"
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoFocus
        />
      </Field>
    </Modal>
  )
}
