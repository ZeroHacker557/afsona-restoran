import { escapeHtml, sendMessage, type Button } from './telegram.js'
import { adminDb } from './firebase-admin.js'

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
  paymentMethod?: string
  status?: string
  products?: {
    product?: { name?: string; price?: number }
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

/** Status → ilova ichidagi bildirishnoma sarlavhasi va matni. */
export const STATUS_NOTIF: Record<string, { title: string; body: (id: string) => string }> = {
  'Qabul qilindi': {
    title: '✅ Buyurtma qabul qilindi',
    body: (id) => `Buyurtmangiz ${id} qabul qilindi va tayyorlanmoqda.`,
  },
  Yetkazilmoqda: {
    title: "🚚 Buyurtma yo'lda",
    body: (id) => `Buyurtmangiz ${id} yetkazib berilmoqda — tez orada yetib boradi!`,
  },
  Yetkazildi: {
    title: '🎉 Buyurtma yetkazildi',
    body: (id) => `Buyurtmangiz ${id} yetkazildi. Yoqimli ishtaha! Baho qoldirishni unutmang.`,
  },
  'Rad etildi': {
    title: '❌ Buyurtma rad etildi',
    body: (id) => `Afsuski, buyurtmangiz ${id} rad etildi. Savol bo'lsa biz bilan bog'laning.`,
  },
  'Bekor qilingan': {
    title: '🚫 Buyurtma bekor qilindi',
    body: (id) => `Buyurtmangiz ${id} bekor qilindi.`,
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
export async function pushNotification(
  userId: number,
  title: string,
  body: string,
  type: 'order' | 'system' | 'promo' = 'order',
) {
  if (!userId) return
  try {
    await (await adminDb()).collection('notifications').add({
      userId: Number(userId),
      title,
      body,
      type,
      read: false,
      date: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[notify] bildirishnoma yozilmadi:', error)
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

/** Yangi buyurtma haqida adminlarga xabar. */
export async function notifyAdminsNewOrder(order: OrderDoc): Promise<number> {
  const chatIds = await notifyChatIds()
  if (!chatIds.length) return 0

  const customer = order.customer || {}
  const items = Array.isArray(order.products) ? order.products : []

  const lines: string[] = []
  lines.push('🆕 <b>YANGI BUYURTMA</b>')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━')
  lines.push(`🆔 <b>${escapeHtml(displayId(order))}</b>`)
  lines.push('')
  lines.push('🛍 <b>Buyurtma:</b>')
  for (const item of items.slice(0, 30)) {
    const name = item?.product?.name || 'Taom'
    const qty = Number(item?.quantity) || 1
    const price = Number(item?.product?.price) || 0
    lines.push(`  • ${escapeHtml(name)} × ${qty} — ${money(price * qty)}`)
  }
  if (items.length > 30) lines.push(`  … va yana ${items.length - 30} ta`)
  lines.push('')
  if (order.discount) lines.push(`🎟 Chegirma: −${money(order.discount)}`)
  if (order.deliveryFee) lines.push(`🚚 Yetkazish: ${money(order.deliveryFee)}`)
  lines.push(`💰 <b>Jami: ${money(order.total)}</b>`)
  lines.push(`💳 To'lov: <b>${escapeHtml(order.paymentMethod || 'Naqd')}</b>`)
  lines.push('')
  lines.push(`👤 ${escapeHtml(customer.name || '—')}`)
  lines.push(`📞 ${escapeHtml(customer.phone || '—')}`)
  lines.push(`📍 ${escapeHtml(customer.address || '—')}`)
  if (customer.comment) lines.push(`📝 ${escapeHtml(customer.comment)}`)

  const buttons: Button[] = []
  const panel = process.env.ADMIN_PANEL_URL
  if (panel) buttons.push({ text: '🛠 Panelda ochish', url: `${panel}#orders` })
  if (customer.location?.lat) {
    buttons.push({
      text: '🗺 Xaritada ko\u2018rish',
      url: `https://maps.google.com/?q=${customer.location.lat},${customer.location.lng}`,
    })
  }

  const text = lines.join('\n')
  let sent = 0
  await Promise.all(
    chatIds.map(async (chatId) => {
      const result = await sendMessage(chatId, text, buttons)
      if (result.ok) sent++
      else console.error(`[notify] admin ${chatId}: ${result.error}`)
    }),
  )
  return sent
}

/** Status o'zgarganda mijozga xabar (Telegram + ilova ichida). */
export async function notifyCustomerStatus(order: OrderDoc, status: string) {
  const userId = Number(order.userId)
  if (!userId) return

  const id = displayId(order)
  const emoji = STATUS_EMOJI[status] || 'ℹ️'

  const text =
    '📦 <b>Buyurtmangiz yangilandi!</b>\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    `🆔 Buyurtma: <b>${escapeHtml(id)}</b>\n` +
    `⏰ Yangi status: ${emoji} <b>${escapeHtml(status)}</b>`

  await sendMessage(userId, text, miniAppButton())

  const notif = STATUS_NOTIF[status]
  await pushNotification(
    userId,
    notif?.title || '📦 Buyurtma yangilandi',
    notif ? notif.body(id) : `Buyurtmangiz ${id} holati o'zgardi: ${status}`,
  )
}
