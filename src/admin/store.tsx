import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  readBrand,
  readDelivery,
  readHoursDoc,
  readPayment,
  watchCategories,
  watchOrders,
  ORDERS_PAGE,
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
import { readDeliveryType, type DeliveryType } from '../utils/delivery'
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
/**
 * Yangi buyurtma ovozi.
 *
 * Ikkala doska uchun ohang ATAYLAB har xil: admin bitta doskaga qarab
 * turganda ikkinchisiga buyurtma tushsa, ekranga qaramasdan ham qaysi
 * turdaligini eshitib biladi.
 *
 *   yetkazish  — ikkita ko'tariluvchi nota (ilgarigidek)
 *   olib ketish — uchta past nota, boshqacha ritm
 */
function playChime(kind: DeliveryType = 'delivery') {
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
    if (kind === 'pickup') {
      play(660, 0)
      play(660, 0.14)
      play(990, 0.30)
    } else {
      play(880, 0)
      play(1320, 0.16)
    }
    setTimeout(() => context.close(), 1400)
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
  const [delivery, setDelivery] = useState<DeliverySettings>({ fee: 0, freeFrom: 0, minOrder: 0, pickupEnabled: false })
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
  /*
   * Jonli ro'yxat chegarasi. Ilgari butun `orders` kolleksiyasi
   * yuklanardi — bir yildan keyin bu o'n minglab hujjat degani.
   * «Ko'proq yuklash» bosilganda chegara oshadi va obuna qayta ochiladi.
   */
  const [ordersLimit, setOrdersLimit] = useState(ORDERS_PAGE)

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
      watchSetting('delivery', readDelivery, setDelivery),
      watchSetting('payment', readPayment, setPayment),
      watchSetting('brand', readBrand, setBrand),
      watchSetting('hours', readHoursDoc, setHours),
    ]

    return () => unsubs.forEach((unsubscribe) => unsubscribe())
  }, [])

  /*
     Buyurtmalar alohida obunada — chegara o'zgarganda faqat shu qayta
     ochiladi, qolgan kolleksiyalar qayta o'qilmaydi.
  */
  useEffect(() => {
    return watchOrders(
      (items) => {
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

            /*
               Ikki doska bor — xabar qaysi biriga tushganini aytishi
               shart. Aks holda admin yetkazish doskasida turib, olib
               ketishga tushgan buyurtmani sezmay qoladi.

               Ikkala turdan bir vaqtda kelsa, har biri uchun alohida
               ovoz va xabar beriladi.
            */
            const byKind: Record<DeliveryType, typeof incoming> = { delivery: [], pickup: [] }
            for (const order of incoming) {
              byKind[readDeliveryType(order.deliveryType)].push(order)
            }

            for (const kind of ['pickup', 'delivery'] as const) {
              const list = byKind[kind]
              if (!list.length) continue
              const where = kind === 'pickup' ? '🏪 Olib ketish' : '🛵 Yetkazish'
              playChime(kind)
              notifyDesktop(list.length, kind)
              toast(
                list.length === 1
                  ? `${where} — yangi buyurtma ${list[0].orderNumber}`
                  : `${where} — ${list.length} ta yangi buyurtma`,
              )
            }
          }
          items.forEach((order) => knownOrders.current!.add(order.id))
        }
        setLoaded((current) => (current.orders ? current : { ...current, orders: true }))
      },
      undefined,
      ordersLimit,
    )
  }, [ordersLimit])

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
      /*
         Faqat ko'rilgan doskaning belgisini o'chiramiz. Ilgari hammasi
         tozalanardi — natijada yetkazish doskasini ochgan admin olib
         ketishdagi o'qilmagan buyurtma belgisini bilmasdan yo'qotardi.
      */
      markOrdersSeen: (ids?: string[]) =>
        setFreshOrderIds((previous) =>
          ids ? previous.filter((id) => !ids.includes(id)) : [],
        ),
      ordersLimit,
      // Ro'yxat to'lib turgan bo'lsa — demak eskiroqlari ham bor
      ordersAtLimit: orders.length >= ordersLimit,
      loadMoreOrders: () => setOrdersLimit((value) => value + ORDERS_PAGE),
    }),
    [
      products, categories, orders, promos, users, delivery, payment, brand, hours,
      loaded, freshOrderIds, ordersLimit,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

/** Brauzer bildirishnomasi — panel boshqa oynada ochiq bo'lsa ham ko'rinadi. */
function notifyDesktop(count: number, kind: DeliveryType) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const where = kind === 'pickup' ? 'Olib ketish' : 'Yetkazish'
  try {
    new Notification(kind === 'pickup' ? '🏪 Olib ketish — yangi buyurtma' : '🛵 Yangi buyurtma', {
      body: count === 1 ? `${where} doskasiga buyurtma tushdi` : `${where}: ${count} ta yangi buyurtma`,
      // Har bir doska o'z xabarini almashtiradi, bir-birini bosmaydi
      tag: `afsona-order-${kind}`,
    })
  } catch {
    /* ba'zi brauzerlar konstruktorni taqiqlaydi */
  }
}
