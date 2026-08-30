import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  readBrand,
  readDelivery,
  readHoursDoc,
  readPayment,
  watchCategories,
  watchOrders,
  watchProducts,
  watchPromos,
  watchSetting,
  watchUsers,
  type AdminCategory,
  type AdminOrder,
  type AdminProduct,
  type AdminPromo,
  type AdminUser,
  type BrandSettings,
  type DeliverySettings,
  type PaymentSettings,
} from './lib/db'
import { DEFAULT_HOURS, type WorkingHours } from '../utils/hours'
import { DataContext, type AdminData } from './lib/data-context'
import { toast } from './lib/toast'

/**
 * Panelning yagona ma'lumot manbayi.
 *
 * Barcha kolleksiyalarga bitta joyda obuna bo'lamiz: sahifalar almashganda
 * qayta-qayta so'rov ketmaydi va yangi buyurtma barcha bo'limlarda bir
 * vaqtda ko'rinadi.
 */

/** Yangi buyurtma signali — brauzerda sintezlangan "ding". */
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const context = new Ctx()
    const play = (frequency: number, start: number) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, context.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.28, context.currentTime + start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + 0.42)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(context.currentTime + start)
      oscillator.stop(context.currentTime + start + 0.45)
    }
    play(880, 0)
    play(1320, 0.16)
    setTimeout(() => context.close(), 1200)
  } catch {
    /* Ovoz muhim emas — brauzer ruxsat bermasa jim o'tamiz */
  }
}

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [promos, setPromos] = useState<AdminPromo[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [delivery, setDelivery] = useState<DeliverySettings>({ fee: 0, freeFrom: 0, minOrder: 0 })
  const [payment, setPayment] = useState<PaymentSettings>({ cardNumber: '', cardOwner: '' })
  const [brand, setBrand] = useState<BrandSettings>({ name: '', phone: '', telegram: '', email: '', address: '' })
  const [hours, setHours] = useState<WorkingHours>(DEFAULT_HOURS)
  /*
   * Har bir kolleksiya uchun alohida "keldi" bayrog'i.
   *
   * Busiz sahifalar ma'lumot kelgunicha nol ko'rsatadi: tushum 0 so'm,
   * mijozlar 0 ta. Bir-uch soniyadan keyin haqiqiy raqamlar chiqadi —
   * bu esa "ma'lumotim yo'qolibdi" degan taassurot qoldiradi.
   */
  const [loaded, setLoaded] = useState({
    products: false,
    categories: false,
    orders: false,
    promos: false,
    users: false,
  })
  const [freshOrderIds, setFreshOrderIds] = useState<string[]>([])

  // Birinchi yuklashda ovoz chalinmasligi uchun oldingi ro'yxatni eslaymiz
  const knownOrders = useRef<Set<string> | null>(null)

  useEffect(() => {
    const mark = (key: keyof typeof loaded) =>
      setLoaded((current) => (current[key] ? current : { ...current, [key]: true }))

    const unsubs = [
      watchProducts((items) => {
        setProducts(items)
        mark('products')
      }),
      watchCategories((items) => {
        setCategories(items)
        mark('categories')
      }),
      watchPromos((items) => {
        setPromos(items)
        mark('promos')
      }),
      watchUsers((items) => {
        setUsers(items)
        mark('users')
      }),
      watchOrders((items) => {
        setOrders(items)

        if (knownOrders.current === null) {
          knownOrders.current = new Set(items.map((order) => order.id))
        } else {
          const incoming = items.filter(
            (order) => !knownOrders.current!.has(order.id) && order.status === 'Yangi',
          )
          if (incoming.length) {
            incoming.forEach((order) => knownOrders.current!.add(order.id))
            setFreshOrderIds((previous) => [...new Set([...previous, ...incoming.map((o) => o.id)])])
            playChime()
            notifyDesktop(incoming.length)
            toast(
              incoming.length === 1
                ? `Yangi buyurtma ${incoming[0].orderNumber}`
                : `${incoming.length} ta yangi buyurtma`,
            )
          }
          items.forEach((order) => knownOrders.current!.add(order.id))
        }
        mark('orders')
      }),
      watchSetting('delivery', readDelivery, setDelivery),
      watchSetting('payment', readPayment, setPayment),
      watchSetting('brand', readBrand, setBrand),
      watchSetting('hours', readHoursDoc, setHours),
    ]

    return () => unsubs.forEach((unsubscribe) => unsubscribe())
  }, [])

  const value = useMemo<AdminData>(
    () => ({
      products,
      categories,
      orders,
      promos,
      users,
      delivery,
      payment,
      brand,
      hours,
      loaded,
      loading: !loaded.products || !loaded.orders,
      freshOrderIds,
      markOrdersSeen: () => setFreshOrderIds([]),
    }),
    [products, categories, orders, promos, users, delivery, payment, brand, hours, loaded, freshOrderIds],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

/** Brauzer bildirishnomasi — panel boshqa oynada ochiq bo'lsa ham ko'rinadi. */
function notifyDesktop(count: number) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification('🆕 Yangi buyurtma', {
      body: count === 1 ? 'Yangi buyurtma tushdi' : `${count} ta yangi buyurtma tushdi`,
      tag: 'afsona-order',
    })
  } catch {
    /* ba'zi brauzerlar konstruktorni taqiqlaydi */
  }
}
