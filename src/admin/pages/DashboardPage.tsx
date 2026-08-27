import { useMemo } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useAdminData } from '../lib/data-context'
import { StatCard, Empty, Chip } from '../components/ui'
import { BarChart, type ChartPoint } from '../components/BarChart'
import { dayKey, dayLabel, money, shortMoney, timeAgo } from '../lib/format'
import { DEAD_STATUSES as DEAD, STATUS_STYLE } from '../lib/status'
import { useNow } from '../lib/now'

export function DashboardPage({ onNavigate }: { onNavigate: (route: 'orders' | 'products') => void }) {
  const { orders, products, users, hours } = useAdminData()
  const now = useNow()

  const stats = useMemo(() => {
    const today = dayKey(new Date(now).toISOString())
    const live = orders.filter((order) => !DEAD.has(order.status))

    const todayOrders = live.filter((order) => dayKey(order.createdAt) === today)
    const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0)

    const week = now - 7 * 24 * 60 * 60 * 1000
    const weekOrders = live.filter((order) => (Date.parse(order.createdAt) || 0) >= week)
    const weekRevenue = weekOrders.reduce((sum, order) => sum + order.total, 0)

    const average = live.length ? Math.round(live.reduce((sum, o) => sum + o.total, 0) / live.length) : 0

    // Oxirgi 14 kunlik tushum
    const byDay = new Map<string, number>()
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      byDay.set(dayKey(date.toISOString()), 0)
    }
    live.forEach((order) => {
      const key = dayKey(order.createdAt)
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) || 0) + order.total)
    })
    const chart: ChartPoint[] = [...byDay.entries()].map(([key, value]) => ({
      label: dayLabel(key),
      value,
    }))

    // Eng ko'p sotilgan taomlar (30 kun)
    const month = now - 30 * 24 * 60 * 60 * 1000
    const sold = new Map<string, { name: string; qty: number; sum: number }>()
    live
      .filter((order) => (Date.parse(order.createdAt) || 0) >= month)
      .forEach((order) => {
        order.products.forEach((item) => {
          const name = item.product?.name || 'Taom'
          const entry = sold.get(name) || { name, qty: 0, sum: 0 }
          entry.qty += Number(item.quantity) || 0
          entry.sum += (Number(item.product?.price) || 0) * (Number(item.quantity) || 0)
          sold.set(name, entry)
        })
      })
    const top = [...sold.values()].sort((a, b) => b.qty - a.qty).slice(0, 6)

    return {
      todayRevenue,
      todayCount: todayOrders.length,
      weekRevenue,
      weekCount: weekOrders.length,
      average,
      pending: orders.filter((order) => order.status === 'Yangi').length,
      chart,
      top,
    }
  }, [orders, now])

  const stopped = products.filter((product) => product.available === false)
  const outOfStock = products.filter((product) => typeof product.stock === 'number' && product.stock! <= 0)
  const recent = orders.slice(0, 6)

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Bugungi tushum"
          value={money(stats.todayRevenue)}
          sub={`${stats.todayCount} ta buyurtma`}
          icon={<TrendingUp size={16} />}
        />
        <StatCard
          label="7 kunlik tushum"
          value={money(stats.weekRevenue)}
          sub={`${stats.weekCount} ta buyurtma`}
          icon={<Receipt size={16} />}
        />
        <StatCard
          label="O'rtacha chek"
          value={money(stats.average)}
          sub={`Jami ${orders.length} ta buyurtma`}
          icon={<ShoppingBag size={16} />}
        />
        <StatCard
          label="Mijozlar"
          value={String(users.length)}
          sub={`${stats.pending} ta buyurtma kutmoqda`}
          icon={<Users size={16} />}
        />
      </div>

      {(stats.pending > 0 || stopped.length > 0 || outOfStock.length > 0 || hours.temporarilyClosed) && (
        <div className="flex flex-wrap gap-2">
          {hours.temporarilyClosed && (
            <button className="adm-btn sm" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'transparent' }}>
              <AlertTriangle size={14} />
              Restoran vaqtincha yopiq
            </button>
          )}
          {stats.pending > 0 && (
            <button className="adm-btn sm" onClick={() => onNavigate('orders')}>
              <Clock size={14} />
              {stats.pending} ta yangi buyurtma kutmoqda
              <ArrowRight size={14} />
            </button>
          )}
          {stopped.length > 0 && (
            <button className="adm-btn sm" onClick={() => onNavigate('products')}>
              <Package size={14} />
              {stopped.length} ta taom stop-listda
            </button>
          )}
          {outOfStock.length > 0 && (
            <button className="adm-btn sm" onClick={() => onNavigate('products')}>
              <AlertTriangle size={14} />
              {outOfStock.length} ta taom qoldig'i tugagan
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="adm-card">
          <div className="adm-card-head">
            <span>Tushum — oxirgi 14 kun</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>
              {shortMoney(stats.chart.reduce((sum, point) => sum + point.value, 0))}
            </span>
          </div>
          <div className="p-4">
            <BarChart data={stats.chart} />
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-head">
            <span>Eng ko'p sotilgan (30 kun)</span>
          </div>
          {stats.top.length === 0 ? (
            <Empty text="Hozircha sotuv yo'q" />
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {stats.top.map((item, index) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span
                    className="grid size-7 flex-shrink-0 place-items-center rounded-lg text-xs font-extrabold"
                    style={{
                      background: index === 0 ? 'var(--brand-soft)' : 'var(--surface-3)',
                      color: index === 0 ? 'var(--brand)' : 'var(--muted)',
                    }}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span>
                  <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                    {item.qty} ta
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-head">
          <span>Oxirgi buyurtmalar</span>
          <button className="adm-btn ghost sm" onClick={() => onNavigate('orders')}>
            Hammasi <ArrowRight size={14} />
          </button>
        </div>
        {recent.length === 0 ? (
          <Empty text="Hali buyurtma yo'q" />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Raqam</th>
                  <th>Mijoz</th>
                  <th>Summa</th>
                  <th>Status</th>
                  <th>Vaqt</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((order) => {
                  const style = STATUS_STYLE[order.status] || STATUS_STYLE.Yangi
                  return (
                    <tr key={order.id}>
                      <td className="font-bold">{order.orderNumber}</td>
                      <td>
                        <div className="font-semibold">{order.customer?.name || '—'}</div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>
                          {order.customer?.phone || ''}
                        </div>
                      </td>
                      <td className="font-bold">{money(order.total)}</td>
                      <td>
                        <Chip color={style.color} background={style.background}>
                          {order.status}
                        </Chip>
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{timeAgo(order.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
