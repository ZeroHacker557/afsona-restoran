import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { Eye, ShoppingCart, TrendingUp, Wallet } from 'lucide-react'
import { db } from '../../lib/firebase'
import { useAdminData } from '../lib/data-context'
import { BarChart, type ChartPoint } from '../components/BarChart'
import { Empty, StatCard } from '../components/ui'
import { dayKey, dayLabel, money } from '../lib/format'
import { DEAD_STATUSES as DEAD } from '../lib/status'
import { useNow } from '../lib/now'

const PERIODS = [7, 30, 90] as const

type DailyRow = { date: string; view?: number; cart_add?: number; checkout_start?: number }
type ProductRow = { productId: string; view?: number; cart_add?: number }

export function StatsPage() {
  const { orders, products } = useAdminData()
  const [days, setDays] = useState<number>(30)
  const now = useNow()
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [productViews, setProductViews] = useState<ProductRow[]>([])

  // Analitika kam o'zgaradi — real vaqt shart emas, bir marta o'qiymiz
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [daysSnap, itemsSnap] = await Promise.all([
          getDocs(collection(db, 'analytics', 'daily', 'days')),
          getDocs(collection(db, 'analytics', 'products', 'items')),
        ])
        if (!alive) return
        setDaily(daysSnap.docs.map((snap) => ({ date: snap.id, ...snap.data() }) as DailyRow))
        setProductViews(
          itemsSnap.docs.map((snap) => ({ productId: snap.id, ...snap.data() }) as ProductRow),
        )
      } catch (error) {
        console.warn('[stats] analitika o‘qilmadi:', error)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const report = useMemo(() => {
    const since = now - days * 86400000
    const inRange = orders.filter((order) => (Date.parse(order.createdAt) || 0) >= since)
    const live = inRange.filter((order) => !DEAD.has(order.status))

    const revenue = live.reduce((sum, order) => sum + order.total, 0)
    const average = live.length ? Math.round(revenue / live.length) : 0

    const byDay = new Map<string, { revenue: number; count: number }>()
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      byDay.set(dayKey(date.toISOString()), { revenue: 0, count: 0 })
    }
    live.forEach((order) => {
      const entry = byDay.get(dayKey(order.createdAt))
      if (entry) {
        entry.revenue += order.total
        entry.count += 1
      }
    })

    const revenueChart: ChartPoint[] = [...byDay.entries()].map(([key, value]) => ({
      label: dayLabel(key),
      value: value.revenue,
    }))
    const countChart: ChartPoint[] = [...byDay.entries()].map(([key, value]) => ({
      label: dayLabel(key),
      value: value.count,
    }))

    const statuses = new Map<string, number>()
    inRange.forEach((order) => statuses.set(order.status, (statuses.get(order.status) || 0) + 1))

    const cash = live.filter((order) => order.paymentMethod !== 'Karta')
    const card = live.filter((order) => order.paymentMethod === 'Karta')

    const sold = new Map<string, { name: string; qty: number; sum: number }>()
    live.forEach((order) =>
      order.products.forEach((item) => {
        const name = item.product?.name || 'Taom'
        const entry = sold.get(name) || { name, qty: 0, sum: 0 }
        entry.qty += Number(item.quantity) || 0
        entry.sum += (Number(item.product?.price) || 0) * (Number(item.quantity) || 0)
        sold.set(name, entry)
      }),
    )

    const viewsInRange = daily
      .filter((row) => {
        const time = Date.parse(row.date)
        return Number.isFinite(time) && time >= since
      })
      .reduce(
        (acc, row) => ({
          view: acc.view + (row.view || 0),
          cart: acc.cart + (row.cart_add || 0),
          checkout: acc.checkout + (row.checkout_start || 0),
        }),
        { view: 0, cart: 0, checkout: 0 },
      )

    return {
      revenue,
      average,
      count: live.length,
      cancelled: inRange.length - live.length,
      revenueChart,
      countChart,
      statuses: [...statuses.entries()].sort((a, b) => b[1] - a[1]),
      cash: { count: cash.length, sum: cash.reduce((sum, order) => sum + order.total, 0) },
      card: { count: card.length, sum: card.reduce((sum, order) => sum + order.total, 0) },
      top: [...sold.values()].sort((a, b) => b.sum - a.sum).slice(0, 10),
      views: viewsInRange,
    }
  }, [orders, days, daily, now])

  const topViewed = useMemo(() => {
    const names = new Map(products.map((product) => [product.id, product.name]))
    return productViews
      .map((row) => ({
        name: names.get(row.productId) || `#${row.productId}`,
        view: row.view || 0,
        cart: row.cart_add || 0,
      }))
      .filter((row) => row.view > 0)
      .sort((a, b) => b.view - a.view)
      .slice(0, 10)
  }, [productViews, products])

  const conversion = report.views.view
    ? Math.round((report.count / report.views.view) * 1000) / 10
    : 0

  return (
    <>
      <div className="flex gap-2">
        {PERIODS.map((item) => (
          <button
            key={item}
            className={`adm-tab ${days === item ? 'active' : ''}`}
            onClick={() => setDays(item)}
          >
            {item} kun
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tushum" value={money(report.revenue)} sub={`${report.count} ta buyurtma`} icon={<TrendingUp size={16} />} />
        <StatCard label="O'rtacha chek" value={money(report.average)} icon={<Wallet size={16} />} />
        <StatCard
          label="Ko'rishlar"
          value={String(report.views.view)}
          sub={`Savatga: ${report.views.cart}`}
          icon={<Eye size={16} />}
        />
        <StatCard
          label="Konversiya"
          value={`${conversion}%`}
          sub={`${report.cancelled} ta bekor qilingan`}
          icon={<ShoppingCart size={16} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="adm-card">
          <div className="adm-card-head">
            <span>Tushum</span>
          </div>
          <div className="p-4">
            <BarChart data={report.revenueChart} />
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-head">
            <span>Buyurtmalar soni</span>
          </div>
          <div className="p-4">
            <BarChart data={report.countChart} money={false} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="adm-card">
          <div className="adm-card-head">
            <span>Statuslar</span>
          </div>
          <div className="flex flex-col gap-2 p-4">
            {report.statuses.length === 0 && <Empty text="Ma'lumot yo'q" />}
            {report.statuses.map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className="w-36 flex-shrink-0 text-sm font-semibold">{status}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.round((count / Math.max(...report.statuses.map((s) => s[1]))) * 100)}%`,
                      background: 'var(--brand)',
                    }}
                  />
                </span>
                <span className="w-10 text-right text-sm font-bold">{count}</span>
              </div>
            ))}

            <div className="mt-2 grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: 'var(--line-soft)' }}>
              <div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>Naqd</div>
                <div className="font-bold">{money(report.cash.sum)}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{report.cash.count} ta</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>Karta</div>
                <div className="font-bold">{money(report.card.sum)}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{report.card.count} ta</div>
              </div>
            </div>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-head">
            <span>Eng ko'p daromad keltirgan taomlar</span>
          </div>
          {report.top.length === 0 ? (
            <Empty text="Sotuv yo'q" />
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Taom</th>
                    <th>Soni</th>
                    <th>Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {report.top.map((item) => (
                    <tr key={item.name}>
                      <td className="font-semibold">{item.name}</td>
                      <td>{item.qty}</td>
                      <td className="font-bold">{money(item.sum)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-head">
          <span>Eng ko'p ko'rilgan taomlar</span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            Butun davr uchun
          </span>
        </div>
        {topViewed.length === 0 ? (
          <Empty text="Analitika hali yig'ilmagan" />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Taom</th>
                  <th>Ko'rishlar</th>
                  <th>Savatga qo'shildi</th>
                  <th>Nisbat</th>
                </tr>
              </thead>
              <tbody>
                {topViewed.map((row) => (
                  <tr key={row.name}>
                    <td className="font-semibold">{row.name}</td>
                    <td>{row.view}</td>
                    <td>{row.cart}</td>
                    <td style={{ color: 'var(--muted)' }}>
                      {row.view ? `${Math.round((row.cart / row.view) * 100)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
