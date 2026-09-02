import { useEffect, useMemo, useState } from 'react'
import { loadOrdersSince, type AdminOrder } from './db'
import { useAdminData } from './data-context'

/**
 * Berilgan kunlar oralig'idagi buyurtmalar — jonli ro'yxat bilan
 * birlashtirilgan holda.
 *
 * Nega kerak: jonli obuna endi oxirgi N ta buyurtma bilan cheklangan
 * (busiz panel har ochilganda butun tarixni yuklardi). Statistika esa
 * 30–90 kunlik davrni ko'rsatishi kerak — chegaralangan ro'yxat bunga
 * yetmaydi va raqamlar kam chiqib qolardi.
 *
 * Shuning uchun ikki manba qo'shiladi:
 *   • bir martalik sana bo'yicha o'qish — davrning eski qismi,
 *   • jonli ro'yxat — yangi buyurtmalar darhol ko'rinsin.
 *
 * Bir xil buyurtma ikkalasida bo'lsa, JONLI qiymat ustun turadi —
 * status o'zgarishi darhol aks etadi.
 */
export function useOrdersRange(days: number): { orders: AdminOrder[]; ready: boolean } {
  const { orders: live, loaded } = useAdminData()

  /*
     Kesh o'zi qaysi davr uchun ekanini eslab qoladi. Davr o'zgarganda
     uni effekt ichida tozalash SHART EMAS — eskirganini `cache.days`
     bo'yicha bilib olamiz. Shu tufayli effekt ichida setState
     chaqirilmaydi (zanjirli render bo'lmaydi).
  */
  const [cache, setCache] = useState<{ days: number; items: AdminOrder[] } | null>(null)

  useEffect(() => {
    let alive = true
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    loadOrdersSince(since)
      .then((items) => {
        if (alive) setCache({ days, items })
      })
      .catch((error) => {
        console.error('[stats] davr bo‘yicha o‘qib bo‘lmadi:', error)
        // Xato bo'lsa ham sahifa ishlasin — jonli ro'yxat qoladi
        if (alive) setCache({ days, items: [] })
      })

    return () => {
      alive = false
    }
  }, [days])

  const history = cache && cache.days === days ? cache.items : null

  const orders = useMemo(() => {
    const byId = new Map<string, AdminOrder>()
    for (const order of history || []) byId.set(order.id, order)
    for (const order of live) byId.set(order.id, order)
    return [...byId.values()].sort(
      (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
    )
  }, [history, live])

  return { orders, ready: history !== null && loaded.orders }
}
