import { useMemo, useState } from 'react'
import {
  Banknote,
  CreditCard,
  LayoutGrid,
  List,
  MapPin,
  Phone,
  Printer,
  Search,
  Trash2,
  User,
} from 'lucide-react'
import { useAdminData } from '../lib/data-context'
import { adminPost } from '../lib/api'
import { Modal } from '../components/Modal'
import { Chip, ConfirmBar, Empty, Spinner } from '../components/ui'
import { toast, toastError } from '../lib/toast'
import { formatDateTime, money, timeAgo } from '../lib/format'
import type { AdminOrder } from '../lib/db'
import { ALL_STATUSES, ORDER_FLOW as FLOW, STATUS_STYLE } from '../lib/status'
import { useNow } from '../lib/now'

const PERIODS = [
  { id: 'today', label: 'Bugun' },
  { id: '7', label: '7 kun' },
  { id: '30', label: '30 kun' },
  { id: 'all', label: 'Hammasi' },
] as const

type Period = (typeof PERIODS)[number]['id']

export function OrdersPage() {
  const { orders, freshOrderIds, markOrdersSeen } = useAdminData()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [period, setPeriod] = useState<Period>('7')
  const [status, setStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AdminOrder | null>(null)

  const now = useNow()

  const filtered = useMemo(() => {
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    const limit =
      period === 'today' ? startOfToday.getTime()
      : period === '7' ? now - 7 * 86400000
      : period === '30' ? now - 30 * 86400000
      : 0

    const needle = search.trim().toLowerCase()

    return orders.filter((order) => {
      if (limit && (Date.parse(order.createdAt) || 0) < limit) return false
      if (status !== 'all' && order.status !== status) return false
      if (!needle) return true
      return (
        order.orderNumber.toLowerCase().includes(needle) ||
        (order.customer?.name || '').toLowerCase().includes(needle) ||
        (order.customer?.phone || '').includes(needle) ||
        (order.customer?.address || '').toLowerCase().includes(needle)
      )
    })
  }, [orders, period, status, search, now])

  // Panel ochilgach yangi buyurtma belgisini o'chiramiz
  const fresh = new Set(freshOrderIds)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--faint)' }}
          />
          <input
            className="adm-input pl-9"
            placeholder="Raqam, ism, telefon yoki manzil"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {PERIODS.map((item) => (
          <button
            key={item.id}
            className={`adm-tab ${period === item.id ? 'active' : ''}`}
            onClick={() => setPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}

        <div className="flex gap-1 rounded-[var(--r-sm)] p-1" style={{ background: 'var(--surface-3)' }}>
          <button
            className="adm-icon-btn"
            style={view === 'board' ? { background: 'var(--surface)', color: 'var(--ink)' } : undefined}
            onClick={() => setView('board')}
            title="Ustunlar"
          >
            <LayoutGrid size={17} />
          </button>
          <button
            className="adm-icon-btn"
            style={view === 'list' ? { background: 'var(--surface)', color: 'var(--ink)' } : undefined}
            onClick={() => setView('list')}
            title="Jadval"
          >
            <List size={17} />
          </button>
        </div>
      </div>

      {view === 'list' && (
        <div className="flex flex-wrap gap-2">
          <button
            className={`adm-tab ${status === 'all' ? 'active' : ''}`}
            onClick={() => setStatus('all')}
          >
            Hammasi
          </button>
          {ALL_STATUSES.map((item) => (
            <button
              key={item}
              className={`adm-tab ${status === item ? 'active' : ''}`}
              onClick={() => setStatus(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="adm-card">
          <Empty text="Bu shartlarga mos buyurtma yo'q" />
        </div>
      ) : view === 'board' ? (
        <div className="adm-board">
          {FLOW.map((column) => {
            const items = filtered.filter((order) => order.status === column)
            return (
              <div key={column} className="adm-column">
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-sm font-bold">{column}</span>
                  <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                    {items.length}
                  </span>
                </div>
                {items.map((order) => (
                  <button
                    key={order.id}
                    className={`adm-order-card ${fresh.has(order.id) ? 'fresh' : ''}`}
                    onClick={() => {
                      setSelected(order)
                      markOrdersSeen()
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold">{order.orderNumber}</span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {timeAgo(order.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold">
                      {order.customer?.name || '—'}
                    </div>
                    <div className="truncate text-xs" style={{ color: 'var(--muted)' }}>
                      {order.products.length} ta taom · {order.customer?.phone || ''}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-bold">{money(order.total)}</span>
                      <span
                        className="flex items-center gap-1 text-xs font-semibold"
                        style={{ color: 'var(--muted)' }}
                      >
                        {order.paymentMethod === 'Karta' ? <CreditCard size={13} /> : <Banknote size={13} />}
                        {order.paymentMethod}
                      </span>
                    </div>
                  </button>
                ))}
                {items.length === 0 && (
                  <div className="py-6 text-center text-xs" style={{ color: 'var(--faint)' }}>
                    Bo'sh
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="adm-card adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Raqam</th>
                <th>Mijoz</th>
                <th>Taomlar</th>
                <th>Summa</th>
                <th>To'lov</th>
                <th>Status</th>
                <th>Sana</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const style = STATUS_STYLE[order.status] || STATUS_STYLE.Yangi
                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelected(order)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="font-bold">{order.orderNumber}</td>
                    <td>
                      <div className="font-semibold">{order.customer?.name || '—'}</div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>
                        {order.customer?.phone}
                      </div>
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{order.products.length} ta</td>
                    <td className="font-bold">{money(order.total)}</td>
                    <td>
                      <span className="text-xs font-semibold">{order.paymentMethod}</span>
                      {order.paymentStatus && (
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>
                          {order.paymentStatus}
                        </div>
                      )}
                    </td>
                    <td>
                      <Chip color={style.color} background={style.background}>
                        {order.status}
                      </Chip>
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{formatDateTime(order.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <OrderModal
          order={orders.find((order) => order.id === selected.id) || selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

// ── Buyurtma oynasi ──────────────────────────────────────────

function OrderModal({ order, onClose }: { order: AdminOrder; onClose: () => void }) {
  const [busy, setBusy] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function setStatus(status: string) {
    setBusy(status)
    try {
      await adminPost('order.status', { orderId: order.id, status })
      toast(`Status: ${status}. Mijozga xabar yuborildi`)
    } catch (error) {
      toastError(error)
    } finally {
      setBusy('')
    }
  }

  async function setPayment(paymentStatus: string) {
    setBusy(paymentStatus)
    try {
      await adminPost('order.payment', { orderId: order.id, paymentStatus })
      toast("To'lov holati yangilandi")
    } catch (error) {
      toastError(error)
    } finally {
      setBusy('')
    }
  }

  async function remove() {
    setBusy('delete')
    try {
      await adminPost('order.delete', { orderId: order.id })
      toast("Buyurtma o'chirildi")
      onClose()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy('')
    }
  }

  const style = STATUS_STYLE[order.status] || STATUS_STYLE.Yangi
  const location = order.customer?.location

  return (
    <Modal
      title={`Buyurtma ${order.orderNumber}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="adm-btn" onClick={() => printOrder(order)}>
            <Printer size={16} />
            Chop etish
          </button>
          <button className="adm-btn danger" onClick={() => setConfirmDelete(true)} disabled={!!busy}>
            <Trash2 size={16} />
            O'chirish
          </button>
        </>
      }
    >
      {confirmDelete && (
        <ConfirmBar
          text="Buyurtma butunlay o'chiriladi. Davom etamizmi?"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={remove}
          busy={busy === 'delete'}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Chip color={style.color} background={style.background}>
          {order.status}
        </Chip>
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {formatDateTime(order.createdAt)}
        </span>
      </div>

      {/* Status tugmalari */}
      <div>
        <span className="adm-label">Statusni o'zgartirish</span>
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((item) => (
            <button
              key={item}
              className={`adm-btn sm ${item === order.status ? 'primary' : ''}`}
              onClick={() => setStatus(item)}
              disabled={!!busy || item === order.status}
            >
              {busy === item ? <Spinner /> : null}
              {item}
            </button>
          ))}
        </div>
        <p className="adm-hint">Status o'zgarganda mijozga Telegram xabari avtomatik ketadi.</p>
      </div>

      {/* Mijoz */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="adm-card adm-card-pad">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <User size={15} /> Mijoz
          </div>
          <div className="text-sm font-semibold">{order.customer?.name || '—'}</div>
          {order.customer?.phone && (
            <a
              href={`tel:${order.customer.phone.replace(/\s/g, '')}`}
              className="mt-1 flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: 'var(--brand)' }}
            >
              <Phone size={14} />
              {order.customer.phone}
            </a>
          )}
          {order.username && (
            <a
              href={`https://t.me/${order.username}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-xs"
              style={{ color: 'var(--info)' }}
            >
              @{order.username}
            </a>
          )}
        </div>

        <div className="adm-card adm-card-pad">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <MapPin size={15} /> Manzil
          </div>
          <div className="text-sm">{order.customer?.address || '—'}</div>
          {order.customer?.comment && (
            <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              Izoh: {order.customer.comment}
            </div>
          )}
          {location && (
            <a
              className="adm-btn sm mt-2"
              href={`https://maps.google.com/?q=${location.lat},${location.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Xaritada ochish
            </a>
          )}
        </div>
      </div>

      {/* Taomlar */}
      <div className="adm-card">
        <div className="adm-card-head">
          <span>Taomlar</span>
          <span className="text-sm" style={{ color: 'var(--muted)' }}>
            {order.products.length} ta
          </span>
        </div>
        <div className="flex flex-col gap-2 p-3">
          {order.products.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              {item.product?.images?.[0] ? (
                <img className="adm-thumb" src={item.product.images[0]} alt="" />
              ) : (
                <span className="adm-thumb" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{item.product?.name}</span>
                <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                  {money(item.product?.price)} × {item.quantity}
                </span>
              </span>
              <span className="text-sm font-bold">
                {money((Number(item.product?.price) || 0) * (Number(item.quantity) || 0))}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 border-t p-3 text-sm" style={{ borderColor: 'var(--line-soft)' }}>
          <Row label="Taomlar" value={money(order.subtotal || 0)} />
          {!!order.discount && (
            <Row
              label={`Chegirma${order.promoCode ? ` (${order.promoCode})` : ''}`}
              value={`− ${money(order.discount)}`}
              tone="var(--success)"
            />
          )}
          <Row label="Yetkazish" value={order.deliveryFee ? money(order.deliveryFee) : 'Bepul'} />
          <div className="mt-1 flex justify-between border-t pt-2 text-base font-extrabold" style={{ borderColor: 'var(--line-soft)' }}>
            <span>Jami</span>
            <span>{money(order.total)}</span>
          </div>
        </div>
      </div>

      {/* To'lov */}
      <div className="adm-card adm-card-pad">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold">
          {order.paymentMethod === 'Karta' ? <CreditCard size={15} /> : <Banknote size={15} />}
          To'lov — {order.paymentMethod}
          {order.paymentStatus && (
            <Chip
              color={order.paymentStatus === 'Tolangan' ? 'var(--success)' : 'var(--warning)'}
              background={order.paymentStatus === 'Tolangan' ? 'var(--success-soft)' : 'var(--warning-soft)'}
            >
              {order.paymentStatus === 'Tolangan' ? "To'langan" : order.paymentStatus}
            </Chip>
          )}
        </div>

        {order.receiptUrl && (
          <a href={order.receiptUrl} target="_blank" rel="noreferrer">
            <img
              src={order.receiptUrl}
              alt="Chek"
              className="mb-2 max-h-64 rounded-[var(--r-sm)] border"
              style={{ borderColor: 'var(--line)' }}
            />
          </a>
        )}

        {order.paymentMethod === 'Karta' && (
          <div className="flex gap-2">
            <button
              className="adm-btn sm"
              onClick={() => setPayment('Tolangan')}
              disabled={!!busy || order.paymentStatus === 'Tolangan'}
            >
              ✅ To'lovni tasdiqlash
            </button>
            <button
              className="adm-btn sm"
              onClick={() => setPayment('Rad etildi')}
              disabled={!!busy || order.paymentStatus === 'Rad etildi'}
            >
              ❌ Rad etish
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ color: tone || 'inherit' }} className="font-semibold">
        {value}
      </span>
    </div>
  )
}

/** Oshxona/kuryer uchun chek — alohida oynada chop etiladi. */
function printOrder(order: AdminOrder) {
  const rows = order.products
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.product?.name || '')}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">${money(
          (Number(item.product?.price) || 0) * (Number(item.quantity) || 0),
        )}</td></tr>`,
    )
    .join('')

  const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8">
<title>${order.orderNumber}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 18px; max-width: 380px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
  td, th { padding: 5px 0; border-bottom: 1px dashed #ccc; }
  .total { font-size: 16px; font-weight: 800; margin-top: 10px; display:flex; justify-content:space-between; }
  .muted { color: #666; font-size: 12px; }
</style></head><body>
  <h1>${order.orderNumber}</h1>
  <div class="muted">${formatDateTime(order.createdAt)}</div>
  <div class="muted">${escapeHtml(order.customer?.name || '')} · ${escapeHtml(order.customer?.phone || '')}</div>
  <div class="muted">${escapeHtml(order.customer?.address || '')}</div>
  ${order.customer?.comment ? `<div class="muted">Izoh: ${escapeHtml(order.customer.comment)}</div>` : ''}
  <table><tbody>${rows}</tbody></table>
  <div class="total"><span>Jami</span><span>${money(order.total)}</span></div>
  <div class="muted">To'lov: ${escapeHtml(order.paymentMethod || '')}</div>
  <script>window.onload = () => { window.print(); }</script>
</body></html>`

  const win = window.open('', '_blank', 'width=420,height=640')
  if (!win) {
    toast('Brauzer yangi oynani bloklab qo‘ydi', 'error')
    return
  }
  win.document.write(html)
  win.document.close()
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
