import { escapeHtml, sendLocation, sendMessage, type Button } from './telegram.js'
import { adminDb } from './firebase-admin.js'
import { isPickup } from './delivery.js'

/**
 * Buyurtma bilan bog'liq xabarlar — mijozga ham, adminlarga ham.
 * Ilgari bu ish bot dasturida bajarilardi (kompyuter yoqiq turishi
 * kerak edi); endi Vercel funksiyasi bevosita Bot API'ga yuboradi.
 */

/** Firestore'dagi buyurtma hujjati — bizga kerak bo'lgan maydonlar. */
export type OrderDoc = {
  id?: string
  orderNumber?: string
  userId?: number | string
  total?: number
  discount?: number
  deliveryFee?: number
  /** 'pickup' — mijoz o'zi olib ketadi. Yo'q bo'lsa — yetkazish. */
  deliveryType?: 'delivery' | 'pickup'
  /** Idishlar uchun jami. Eski buyurtmalarda yo'q. */
  containerFee?: number
  paymentMethod?: string
  paymentStatus?: string
  status?: string
  /** Bekor qilish/rad etish sababi — admin paneldan tanlanadi. */
  cancelReason?: string
  /** Buyurtmani olgan kuryerning Telegram id'si. */
  courierId?: number
  courierName?: string
  /** Kuryerlarga yuborilgan xabarlar — keyin tahrirlash uchun. */
  courierMsgs?: { chatId: number; messageId: number }[]
  products?: {
    product?: { name?: string; price?: number; containerPrice?: number }
    quantity?: number
  }[]
  customer?: {
    name?: string
    phone?: string
    address?: string
    comment?: string
    location?: { lat: number; lng: number } | null
  }
  [key: string]: unknown
}

export const STATUS_EMOJI: Record<string, string> = {
  Yangi: '🆕',
  'Qabul qilindi': '🟢',
  Yetkazilmoqda: '🚚',
  Yetkazildi: '🎉',
  'Rad etildi': '🔴',
  'Bekor qilingan': '🔴',
}

/**
 * Status → ilova ichidagi bildirishnoma.
 *
 * `what` — buyurtma raqami emas, TAOM nomi (masalan "Toy oshi va yana
 * 2 ta taom"). Mijoz uchun "#1015" hech narsa anglatmaydi, taom nomi
 * esa darhol tanish.
 */
export const STATUS_NOTIF: Record<string, { title: string; body: (what: string) => string }> = {
  'Qabul qilindi': {
    title: '✅ Buyurtma qabul qilindi',
    body: (what) => `${what} — tayyorlashni boshladik.`,
  },
  Yetkazilmoqda: {
    title: "🚚 Buyurtmangiz yo'lda",
    body: (what) => `${what} — kuryer yo'lga chiqdi, tez orada yetib boradi!`,
  },
  Yetkazildi: {
    title: '🎉 Buyurtma yetkazildi',
    body: (what) => `${what} yetkazildi. Yoqimli ishtaha! Baho qoldirishni unutmang.`,
  },
  'Rad etildi': {
    title: '❌ Buyurtma rad etildi',
    body: (what) => `Afsuski, buyurtmangiz rad etildi (${what}). Savol bo'lsa biz bilan bog'laning.`,
  },
  'Bekor qilingan': {
    title: '🚫 Buyurtma bekor qilindi',
    body: (what) => `Buyurtmangiz bekor qilindi (${what}).`,
  },
}

/**
 * Mijozga yuboriladigan "Ilovani ochish" tugmasi.
 *
 * `miniApp: true` — Telegram uni web_app tugmasi qilib chizadi va ilova
 * Telegram ichida ochiladi. Oddiy havola bo'lsa, brauzerga olib chiqib
 * ketardi va mijoz u yerda "Telegram'da oching" ekranini ko'rardi.
 */
export function miniAppButton(): Button[] {
  const url = process.env.MINI_APP_URL
  return url ? [{ text: '🍽 Ilovani ochish', url, miniApp: true }] : []
}

/** Ilova ichidagi bildirishnoma yozadi (xatolik butun amalni to'xtatmaydi). */
/**
 * Bitta mijozda saqlanadigan maksimal bildirishnoma soni.
 *
 * Ilgari chegara umuman yo'q edi: har status o'zgarishida yozuv
 * qo'shilar, hech qachon o'chirilmasdi. Bir yil ilovadan foydalangan
 * mijozda yuzlab yozuv to'planar va ILOVA HAR OCHILGANDA HAMMASI
 * yuklanardi (so'rov `where('userId','==')` bo'yicha, chegarasiz).
 */
const NOTIF_KEEP = 100

/** Har necha yozuvda bir marta tozalash ishga tushadi. */
const TRIM_CHANCE = 20

export async function pushNotification(
  userId: number,
  title: string,
  body: string,
  type: 'order' | 'system' | 'promo' = 'order',
) {
  if (!userId) return
  try {
    const db = await adminDb()
    await db.collection('notifications').add({
      userId: Number(userId),
      title,
      body,
      type,
      read: false,
      date: new Date().toISOString(),
    })

    // Tozalashni har safar qilmaymiz — u qo'shimcha so'rov turadi.
    // Tasodifiy tanlov bilan o'rtacha xarajat kichik bo'ladi, son esa
    // NOTIF_KEEP atrofida ushlab turiladi.
    if (Math.random() < 1 / TRIM_CHANCE) await trimNotifications(db, Number(userId))
  } catch (error) {
    console.error('[notify] bildirishnoma yozilmadi:', error)
  }
}

/**
 * Mijozning eng eski bildirishnomalarini o'chiradi.
 *
 * So'rovda faqat bitta tenglik sharti bor — shuning uchun qo'shimcha
 * composite indeks kerak emas. Saralash bu yerda, xotirada bajariladi.
 */
async function trimNotifications(db: FirebaseFirestore.Firestore, userId: number) {
  try {
    /*
       Chegara qo'ymaymiz: `orderBy` siz `limit` tasodifiy hujjatlarni
       qaytaradi va "eng eskisi" noto'g'ri hisoblanardi. Son NOTIF_KEEP
       atrofida ushlab turilgani uchun bu so'rov ~100 hujjatdan oshmaydi.
    */
    const snap = await db.collection('notifications').where('userId', '==', userId).get()

    if (snap.size <= NOTIF_KEEP) return

    const eskidan = snap.docs.sort(
      (a, b) => (Date.parse(String(a.data().date)) || 0) - (Date.parse(String(b.data().date)) || 0),
    )
    const ortiqcha = eskidan.slice(0, snap.size - NOTIF_KEEP)

    const batch = db.batch()
    ortiqcha.forEach((doc) => batch.delete(doc.ref))
    await batch.commit()

    console.log(`[notify] ${userId}: ${ortiqcha.length} ta eski bildirishnoma o'chirildi`)
  } catch (error) {
    // Tozalash muvaffaqiyatsiz bo'lsa ham bildirishnoma yozilgan
    console.error('[notify] tozalab bo‘lmadi:', error)
  }
}

/** Xabarnoma yuboriladigan adminlarning Telegram ID'lari. */
export async function notifyChatIds(): Promise<number[]> {
  const ids = new Set<number>()

  for (const raw of String(process.env.ADMIN_CHAT_IDS || '').split(/[,\s;]+/)) {
    const id = Number(raw)
    if (Number.isFinite(id) && id !== 0) ids.add(id)
  }

  try {
    const snap = await (await adminDb()).collection('settings').doc('admins').get()
    const stored = snap.exists ? snap.data()?.ids : null
    if (Array.isArray(stored)) {
      for (const raw of stored) {
        const id = Number(raw)
        if (Number.isFinite(id) && id !== 0) ids.add(id)
      }
    }
  } catch (error) {
    console.error('[notify] admin ID lari o\u2018qilmadi:', error)
  }

  return [...ids]
}

export function money(amount: unknown): string {
  const value = Math.round(Number(amount) || 0)
  return value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ') + " so'm"
}

export function displayId(order: OrderDoc): string {
  const number = order.orderNumber || order.id
  const text = String(number || '')
  return text.startsWith('#') ? text : `#${text}`
}

/**
 * Lokatsiya ostiga yoziladigan qisqa ma'lumot: mijoz, telefon, manzil
 * va taomlar. Kuryerga shu xabarning o'zi yetarli bo'lishi kerak.
 */
export function locationCaption(order: OrderDoc): string {
  const customer = order.customer || {}
  const items = Array.isArray(order.products) ? order.products : []

  const lines: string[] = []
  lines.push(`📍 <b>Yetkazish manzili — ${escapeHtml(displayId(order))}</b>`)
  lines.push('')
  lines.push(`👤 ${escapeHtml(customer.name || '—')}`)
  lines.push(`📞 ${escapeHtml(customer.phone || '—')}`)
  lines.push(`🏠 ${escapeHtml(customer.address || '—')}`)
  if (customer.comment) lines.push(`📝 ${escapeHtml(customer.comment)}`)

  if (items.length) {
    lines.push('')
    lines.push('🍽 <b>Buyurtma:</b>')
    for (const item of items.slice(0, 30)) {
      const name = item?.product?.name || 'Taom'
      const qty = Number(item?.quantity) || 1
      // 🥡 — oshxona va kuryer idish kerakligini bir qarashda ko'rsin
      const idish = Number(item?.product?.containerPrice) > 0 ? ' 🥡' : ''
      lines.push(`  • ${escapeHtml(name)} × ${qty}${idish}`)
    }
    if (items.length > 30) lines.push(`  … va yana ${items.length - 30} ta`)
  }

  lines.push('')
  lines.push(`💰 <b>${money(order.total)}</b> · ${escapeHtml(order.paymentMethod || 'Naqd')}`)

  return lines.join('\n')
}

/**
 * Buyurtma lokatsiyasini berilgan chatlarga yuboradi: avval xarita
 * nuqtasi, ketidan mijoz ma'lumotlari.
 */
export async function sendOrderLocation(
  order: OrderDoc,
  chatIds: number[],
): Promise<{ sent: number; error?: string }> {
  const location = order.customer?.location
  const lat = Number(location?.lat)
  const lng = Number(location?.lng)

  if (isPickup(order)) {
    return { sent: 0, error: 'Bu — olib ketish buyurtmasi, yetkazish manzili yo‘q' }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { sent: 0, error: 'Bu buyurtmada xarita nuqtasi yo‘q' }
  }
  if (!chatIds.length) {
    return { sent: 0, error: 'Xabar yuboriladigan Telegram ID topilmadi' }
  }

  const caption = locationCaption(order)
  let sent = 0

  for (const chatId of chatIds) {
    const pin = await sendLocation(chatId, lat, lng)
    if (!pin.ok) {
      console.error(`[notify] lokatsiya ${chatId}: ${pin.error}`)
      continue
    }
    await sendMessage(chatId, caption)
    sent++
  }

  return { sent }
}

/** Aloqa ma'lumotlari — settings/brand hujjatidan. */
async function brandContact(): Promise<{ phone: string; address: string }> {
  try {
    const snap = await (await adminDb()).collection('settings').doc('brand').get()
    if (!snap.exists) return { phone: '', address: '' }
    const data = snap.data() || {}
    return { phone: String(data.phone || ''), address: String(data.address || '') }
  } catch {
    return { phone: '', address: '' }
  }
}

async function brandPhone(): Promise<string> {
  return (await brandContact()).phone
}

/** Taomlar ro'yxati — mijozga ko'rinadigan ko'rinishda. */
function customerItems(order: OrderDoc): string[] {
  const items = Array.isArray(order.products) ? order.products : []
  if (!items.length) return []

  const lines = ['🍽 <b>Buyurtmangiz:</b>']
  for (const item of items.slice(0, 20)) {
    const name = item?.product?.name || 'Taom'
    const qty = Number(item?.quantity) || 1
    const price = Number(item?.product?.price) || 0
    const idish = Number(item?.product?.containerPrice) > 0 ? ' 🥡' : ''
    lines.push(`  • ${escapeHtml(name)} × ${qty}${idish} — ${money(price * qty)}`)
  }
  if (items.length > 20) lines.push(`  … va yana ${items.length - 20} ta`)
  return lines
}

/**
 * Har bir status uchun alohida sarlavha va izoh.
 *
 * Nega umumiy "buyurtmangiz yangilandi" emas: mijoz uchun buyurtma
 * raqami hech narsa anglatmaydi. U nima buyurtma qilgani, qancha
 * to'lashi va endi nima bo'lishini bilishi kerak.
 */
const CUSTOMER_STATUS: Record<string, { title: string; note: string }> = {
  'Qabul qilindi': {
    title: '✅ <b>Buyurtmangiz qabul qilindi!</b>',
    note: 'Rahmat! Taomlaringizni tayyorlashni boshladik.',
  },
  Yetkazilmoqda: {
    title: '🛵 <b>Buyurtmangiz yo‘lga chiqdi!</b>',
    note: 'Kuryerimiz yo‘lda. Iltimos, telefoningizni yoningizda saqlang.',
  },
  Yetkazildi: {
    title: '🎉 <b>Buyurtmangiz yetkazildi!</b>',
    note: 'Yoqimli ishtaha! Taomlar yoqqan bo‘lsa, ilovada baho qoldiring — bu biz uchun juda muhim.',
  },
  'Bekor qilingan': {
    title: '🚫 <b>Buyurtmangiz bekor qilindi</b>',
    note: 'Agar bu xato bo‘lsa yoki savolingiz bo‘lsa, biz bilan bog‘laning.',
  },
  'Rad etildi': {
    title: '❌ <b>Buyurtmangiz rad etildi</b>',
    note: 'Uzr so‘raymiz. Sabab haqida bilish uchun biz bilan bog‘laning.',
  },
}

/**
 * Olib ketish buyurtmasi uchun alohida matnlar.
 *
 * «Yetkazilmoqda» bu yerda eng muhim payt: taom tayyor va mijoz kelishi
 * mumkin. Xabarga restoran manzili va telefoni qo'shiladi — mijoz
 * qayerga borishini qidirib yurmasin.
 */
const PICKUP_STATUS: Record<string, { title: string; note: string }> = {
  'Qabul qilindi': {
    title: '✅ <b>Buyurtmangiz qabul qilindi!</b>',
    note: 'Tayyorlashni boshladik. Tayyor bo‘lganda shu yerda xabar beramiz.',
  },
  Yetkazilmoqda: {
    title: '🥡 <b>Buyurtmangiz tayyor!</b>',
    note: 'Kelib olib ketishingiz mumkin. To‘lov joyida amalga oshiriladi.',
  },
  Yetkazildi: {
    title: '🎉 <b>Buyurtmangiz topshirildi!</b>',
    note: 'Yoqimli ishtaha! Taomlar yoqqan bo‘lsa, ilovada baho qoldiring — bu biz uchun juda muhim.',
  },
}

/** Status o'zgarganda mijozga xabar (Telegram + ilova ichida). */
export async function notifyCustomerStatus(order: OrderDoc, status: string) {
  const userId = Number(order.userId)
  if (!userId) return

  const id = displayId(order)
  const customer = order.customer || {}
  const pickup = isPickup(order)
  const info = (pickup ? PICKUP_STATUS[status] : undefined) || CUSTOMER_STATUS[status]
  const cancelled = status === 'Bekor qilingan' || status === 'Rad etildi'

  const lines: string[] = []
  lines.push(info?.title || `📦 <b>Buyurtmangiz yangilandi</b>`)
  lines.push('')
  lines.push(info?.note || `Yangi holat: ${escapeHtml(status)}`)

  // Taomlar — bekor qilinganda ham ko'rsatamiz, mijoz qaysi buyurtma
  // ekanini tanishi uchun
  const items = customerItems(order)
  if (items.length) {
    lines.push('')
    lines.push(...items)
  }

  if (!cancelled) {
    lines.push('')
    if (Number(order.containerFee) > 0) {
      lines.push(`🥡 Idishlar: ${money(Number(order.containerFee))}`)
    }
    lines.push(`💰 <b>Jami: ${money(order.total)}</b>`)
    if (order.paymentMethod) {
      const paid = order.paymentMethod === 'Karta' && order.paymentStatus === 'Tolangan'
      lines.push(`💳 To‘lov: ${escapeHtml(order.paymentMethod)}${paid ? ' — to‘langan' : ''}`)
    }
  }

  if (pickup) {
    /*
       Taom tayyor bo'lganda mijozga QAYERGA borishini aytamiz. Busiz u
       manzilni qidirib, oxiri restoranga qo'ng'iroq qiladi — aynan
       shuni kamaytirish uchun bu funksiya qilinmoqda.
    */
    if (status === 'Yetkazilmoqda' && !cancelled) {
      const { phone, address } = await brandContact()
      if (address || phone) {
        lines.push('')
        if (address) lines.push(`📍 <b>${escapeHtml(address)}</b>`)
        if (phone) lines.push(`📞 ${escapeHtml(phone)}`)
      }
    }
  } else if ((status === 'Qabul qilindi' || status === 'Yetkazilmoqda') && customer.address) {
    lines.push('')
    lines.push(`📍 ${escapeHtml(customer.address)}`)
  }

  if (cancelled) {
    // Sabab bo'lsa aytamiz — «nega bekor qilindi?» degan qo'ng'iroq kamayadi
    const reason = (order.cancelReason || '').trim()
    if (reason) {
      lines.push('')
      lines.push(`📌 <b>Sabab:</b> ${escapeHtml(reason)}`)
    }

    const phone = await brandPhone()
    if (phone) {
      lines.push('')
      lines.push(`📞 ${escapeHtml(phone)}`)
    }
  }

  lines.push('')
  lines.push(`<i>Buyurtma ${escapeHtml(id)}</i>`)

  await sendMessage(userId, lines.join('\n'), miniAppButton())

  // Ilova ichidagi bildirishnoma — qisqa, lekin taom nomi bilan
  const first = order.products?.[0]?.product?.name
  const count = Array.isArray(order.products) ? order.products.length : 0
  const what = first
    ? count > 1
      ? `${first} va yana ${count - 1} ta taom`
      : first
    : `Buyurtmangiz ${id}`

  const notif = STATUS_NOTIF[status]
  await pushNotification(
    userId,
    notif?.title || '📦 Buyurtma yangilandi',
    notif ? notif.body(what) : `${what} — holat: ${status}`,
  )
}
