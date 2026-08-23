import { useMemo, useState } from 'react'
import { ChevronDown, ExternalLink, ShoppingBag, SlidersHorizontal } from 'lucide-react'
import { formatPrice } from '../data'
import { getImageUrl } from '../utils/telegram'
import { formatOrderDate } from '../utils/date'
import { PageHeader } from '../components/layout/PageHeader'
import { openBotDeepLink } from '../utils/telegram'
import type { Order } from '../types/domain'

const BOT_USERNAME = 'ecommercy_test_bot'

const tabs = ['Barchasi', 'Yangi', 'Qabul qilindi', 'Bekor qilingan']

type Props = {
  orders: Order[]
  cartCount: number
  onSearch: () => void
  onOpenCart: () => void
}

export function OrdersPage({ orders, cartCount, onSearch, onOpenCart }: Props) {
  const [active, setActive] = useState('Barchasi')
  const [newest, setNewest] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (active === 'Barchasi') return orders
    if (active === 'Bekor qilingan') return orders.filter((o) => o.status === 'Bekor qilingan')
    if (active === 'Yangi') return orders.filter((o) => o.status === 'Yangi')
    if (active === 'Qabul qilindi')
      return orders.filter(
        (o) => o.status === 'Qabul qilindi' || o.status === 'Yetkazilmoqda' || o.status === 'Yetkazildi'
      )
    return orders
  }, [active, orders])

  const shown = newest ? filtered : [...filtered].reverse()

  const getStatusColor = (status: string) => {
    if (status === 'Bekor qilingan' || status === 'Rad etildi') return '#ef4444'
    if (status === 'Yetkazilmoqda') return '#d97706'
    if (status === 'Yetkazildi') return '#16a34a'
    if (status === 'Qabul qilindi') return '#2563eb'
    return '#7c3aed'
  }

  /** Karta uchun to'lov holati badge va tugma */
  const getPayInfo = (order: Order) => {
    if (order.paymentMethod !== 'Karta') return null
    const s = order.paymentStatus
    if (s === 'Tolangan') return { label: '✅ To\'lov tasdiqlandi', color: '#16a34a', bg: '#dcfce7', needsAction: false }
    if (s === 'Rad etildi') return { label: '❌ Chek rad etildi', color: '#ef4444', bg: '#fee2e2', needsAction: true }
    return { label: '⏳ Chek kutilmoqda', color: '#d97706', bg: '#fef9c3', needsAction: true }
  }

  /** Botni ochib, FSM orqali chek so'rash. Payload — Firestore hujjat id'si (F-03). */
  const handleSendReceipt = (orderId: string) => {
    openBotDeepLink(BOT_USERNAME, `receipt_${orderId}`)
  }

  return (
    <>
      <PageHeader title="Buyurtmalarim" onSearch={onSearch} onCart={onOpenCart} cartCount={cartCount} />

      {/* Tabs */}
      <div className="mt-7 flex gap-7 overflow-x-auto border-b border-slate-100 px-5 sm:px-10 scrollbar-none">
        {tabs.map((label) => (
          <button
            onClick={() => setActive(label)}
            key={label}
            className={'tab whitespace-nowrap ' + (active === label ? 'active' : '')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <section className="flex items-center justify-end px-5 pt-6 sm:px-10">
        <button onClick={() => setNewest((v) => !v)} className="filter-button">
          <SlidersHorizontal size={19} />
          <span>{newest ? 'Eng yangi' : 'Eng eski'}</span>
          <ChevronDown size={18} className={`transition-transform duration-300 ${!newest ? 'rotate-180' : ''}`} />
        </button>
      </section>

      {/* Orders */}
      <section className="space-y-4 px-5 pb-32 pt-6 sm:px-10">
        {shown.map((order, i) => {
          const payInfo = getPayInfo(order)
          const isExpanded = expandedId === order.id
          
          return (
            <div key={order.id} className="order-card flex-col gap-3" style={{ animationDelay: `${i * 0.08}s` }}>
              <div 
                className="flex flex-col gap-3 cursor-pointer" 
                onClick={() => setExpandedId(isExpanded ? null : order.id)}
              >
                {/* Header row */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                      {formatOrderDate(order.createdAt) || order.date}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {payInfo && !payInfo.needsAction && (
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: payInfo.bg, color: payInfo.color }}>
                          To'landi
                        </span>
                      )}
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: getStatusColor(order.status) }}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[15px] font-extrabold leading-tight" style={{ color: '#111426' }}>
                        {order.products.map(p => p.product.name).join(', ')}
                      </h3>
                      <p className="mt-0.5 text-[11px] font-semibold" style={{ color: '#64748b' }}>
                        {order.products.length} ta mahsulot
                      </p>
                    </div>
                    <p className="shrink-0 text-[15px] font-extrabold" style={{ color: '#111426' }}>
                      {formatPrice(order.total)}
                    </p>
                  </div>
                </div>

                {/* Toggle & ID text */}
                <div className="mt-1 flex items-center justify-between border-t border-slate-50 pt-2.5">
                  <p className="text-[11px] font-bold" style={{ color: '#94a3b8' }}>{order.orderNumber}</p>
                  <div className="flex items-center text-xs font-bold" style={{ color: '#7c3aed' }}>
                    {isExpanded ? 'Yashirish' : 'Tafsilotlar'}
                    <ChevronDown size={14} className={`ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </div>

              {/* Products List */}
              {isExpanded && (
                <div className="mt-2 space-y-2 border-t border-slate-100 pt-3" style={{ animation: 'fadeIn 0.3s ease' }}>
                  {order.products.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                      <img
                        src={item.product.images?.[0] ? getImageUrl(item.product.images[0]) : ''}
                        alt={item.product.name}
                        className="size-12 rounded-lg border border-slate-100 object-contain p-1"
                      />
                      <div className="text-sm min-w-0">
                        <p className="font-bold truncate" style={{ color: '#111426' }}>{item.product.name}</p>
                        <p className="text-[11px] font-medium" style={{ color: '#64748b' }}>
                          {item.quantity} ta
                          {item.size && ` | O'lcham: ${item.size}`}
                          {item.color && ` | Rang: ${item.color}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Chek yuborish tugmasi — faqat Karta + to'lanmagan */}
              {payInfo?.needsAction && (
                <button
                  onClick={() => handleSendReceipt(order.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition active:scale-95"
                  style={{
                    background: payInfo.color === '#ef4444' ? '#fee2e2' : '#fef9c3',
                    color: payInfo.color,
                    border: `1.5px solid ${payInfo.color}30`,
                  }}
                >
                  <ExternalLink size={15} />
                  {payInfo.color === '#ef4444' ? '💳 Qayta chek yuborish' : '💳 To\'lov chekini yuborish'}
                </button>
              )}
            </div>
          )
        })}

        {!shown.length && (
          <div className="flex flex-col items-center py-20 text-center" style={{ animation: 'fadeInUp 0.5s ease' }}>
            <span className="grid size-20 place-items-center rounded-full" style={{ background: '#f5f0ff', color: '#a78bfa' }}>
              <ShoppingBag size={36} />
            </span>
            <p className="mt-5 text-lg font-bold" style={{ color: '#334155' }}>
              {orders.length === 0 ? "Buyurtmalar hali yo'q" : "Bu bo'limda buyurtma topilmadi"}
            </p>
            <p className="mt-2 text-sm" style={{ color: '#94a3b8' }}>
              {orders.length === 0 ? 'Birinchi buyurtmangizni bering!' : "Boshqa bo'limni tanlang."}
            </p>
          </div>
        )}
      </section>
    </>
  )
}
