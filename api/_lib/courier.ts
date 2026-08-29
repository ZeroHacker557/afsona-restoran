import { adminDb } from './firebase-admin.js'
import { editMessageText, escapeHtml, sendMessage, type Button } from './telegram.js'
import { displayId, money, notifyCustomerStatus, type OrderDoc } from './order-notify.js'

/**
 * Kuryerlar oqimi.
 *
 * Buyurtma yaratilganda u kuryerlarga (shaxsiy chatga) va/yoki xodimlar
 * guruhiga tugmalar bilan yuboriladi:
 *
 *   [📦 Oldim]  → buyurtmani o'ziga biriktiradi, status "Yetkazilmoqda"
 *   [✅ Yetkazildi] → status "Yetkazildi"
 *
 * MUHIM tamoyillar:
 *
 * 1. Tugmani faqat KURYER bosa oladi. Guruhda boshqa odam bossa,
 *    unga "bu tugma faqat kuryer uchun" deb ogohlantirish chiqadi va
 *    hech narsa o'zgarmaydi.
 * 2. Buyurtmani birinchi bosgan kuryer oladi. Ikkinchisi bosganda
 *    "buyurtmani falonchi olgan" deb yozadi — bu Firestore tranzaksiyasi
 *    bilan kafolatlanadi, ya'ni ikkalasiga ham "sizniki" deb chiqmaydi.
 * 3. Mijozning telefon raqami buyurtma OLINGUNCHA yashirin. Guruhda
 *    o'ntacha odam bo'lishi mumkin — raqam faqat olgan kuryerga ochiladi.
 * 4. Butun mantiq shu yerda: bot faqat tugma bosilganini yetkazadi.
 *    Shu tufayli xabar matni, status va mijozga boradigan bildirishnoma
 *    bitta joydan boshqariladi.
 */

export type Courier = {
  id: number
  name: string
  phone?: string
  active?: boolean
}

export type CourierSettings = {
  list: Courier[]
  /** Xodimlar guruhi (manfiy raqam). `/guruh` buyrug'i bilan biriktiriladi. */
  groupChatId: number | null
  groupTitle: string
  /** Buyurtma qayerga yuborilsin. */
  mode: 'private' | 'group' | 'both'
}

/** Yuborilgan xabar manzili — keyin tahrirlash uchun saqlanadi. */
type MessageRef = { chatId: number; messageId: number }

const SETTINGS_DOC = 'couriers'

export async function readCourierSettings(): Promise<CourierSettings> {
  const fallback: CourierSettings = { list: [], groupChatId: null, groupTitle: '', mode: 'both' }
  try {
    const snap = await (await adminDb()).collection('settings').doc(SETTINGS_DOC).get()
    if (!snap.exists) return fallback

    const data = snap.data() || {}
    const list: Courier[] = Array.isArray(data.list)
      ? data.list
          .map((item: Record<string, unknown>) => ({
            id: Number(item?.id),
            name: String(item?.name || '').slice(0, 60),
            phone: item?.phone ? String(item.phone).slice(0, 40) : undefined,
            active: item?.active !== false,
          }))
          .filter((item: Courier) => Number.isFinite(item.id) && item.id !== 0)
      : []

    const group = Number(data.groupChatId)
    const mode = data.mode === 'private' || data.mode === 'group' ? data.mode : 'both'

    return {
      list,
      groupChatId: Number.isFinite(group) && group !== 0 ? group : null,
      groupTitle: String(data.groupTitle || ''),
      mode,
    }
  } catch (error) {
    console.error('[courier] sozlamalar o‘qilmadi:', error)
    return fallback
  }
}

export function findCourier(settings: CourierSettings, userId: number): Courier | null {
  return settings.list.find((item) => item.id === userId && item.active !== false) || null
}

// ── Xabar matni ──────────────────────────────────────────────

function itemLines(order: OrderDoc): string[] {
  const items = Array.isArray(order.products) ? order.products : []
  const lines = items.slice(0, 30).map((item) => {
    const name = item?.product?.name || 'Taom'
    const qty = Number(item?.quantity) || 1
    return `  • ${escapeHtml(name)} × ${qty}`
  })
  if (items.length > 30) lines.push(`  … va yana ${items.length - 30} ta`)
  return lines
}

/**
 * Kuryerga ko'rinadigan matn.
 * `revealed` — buyurtma olinganmi: telefon shundan keyin ko'rsatiladi.
 */
export function courierText(order: OrderDoc, revealed: boolean): string {
  const customer = order.customer || {}
  const status = String(order.status || '')

  const lines: string[] = []
  lines.push(`🛵 <b>YETKAZISH — ${escapeHtml(displayId(order))}</b>`)
  lines.push('━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')
  lines.push(...itemLines(order))
  lines.push('')
  lines.push(`💰 <b>${money(order.total)}</b> · ${escapeHtml(order.paymentMethod || 'Naqd')}`)
  if (order.paymentMethod === 'Karta') {
    const paid = order.paymentStatus === 'Tolangan'
    lines.push(paid ? '✅ To‘langan — pul olinmaydi' : '⚠️ To‘lov tasdiqlanmagan')
  }
  lines.push('')
  lines.push(`🏠 ${escapeHtml(customer.address || '—')}`)
  if (customer.comment) lines.push(`📝 ${escapeHtml(customer.comment)}`)

  if (revealed) {
    lines.push('')
    lines.push(`👤 ${escapeHtml(customer.name || '—')}`)
    lines.push(`📞 ${escapeHtml(customer.phone || '—')}`)
  } else {
    lines.push('')
    lines.push('<i>Mijozning ismi va telefoni «Oldim» bosilgach ko‘rinadi.</i>')
  }

  if (order.courierName) {
    lines.push('')
    const mark = status === 'Yetkazildi' ? '✅' : '🛵'
    lines.push(`${mark} <b>Kuryer:</b> ${escapeHtml(order.courierName)}`)
  }
  if (status === 'Yetkazildi') {
    lines.push('🎉 <b>Yetkazildi</b>')
  } else if (status === 'Bekor qilingan' || status === 'Rad etildi') {
    lines.push(`🚫 <b>${escapeHtml(status)}</b>`)
  }

  return lines.join('\n')
}

function mapsUrl(order: OrderDoc): string | null {
  const location = order.customer?.location
  if (!location?.lat) return null
  return `https://maps.google.com/?q=${location.lat},${location.lng}`
}

/** Buyurtma holatiga mos tugmalar to'plami. */
export function courierButtons(order: OrderDoc): Button[] {
  const status = String(order.status || '')
  const buttons: Button[] = []

  const map = mapsUrl(order)
  if (map) buttons.push({ text: '🗺 Xaritada ko‘rish', url: map })

  if (status === 'Yetkazildi' || status === 'Bekor qilingan' || status === 'Rad etildi') {
    return buttons
  }

  if (!order.courierId) {
    buttons.push({ text: '📦 Oldim', url: '', callback: `take:${order.id}` })
  } else {
    if (map) buttons.push({ text: '📍 Lokatsiyani olish', url: '', callback: `loc:${order.id}` })
    buttons.push({ text: '✅ Yetkazildi', url: '', callback: `done:${order.id}` })
  }

  return buttons
}

// ── Yuborish ─────────────────────────────────────────────────

/** Buyurtma tushganda kuryerlarga va/yoki guruhga yuboradi. */
export async function notifyCouriersNewOrder(order: OrderDoc): Promise<number> {
  const settings = await readCourierSettings()

  const targets: number[] = []
  if (settings.mode !== 'group') {
    for (const courier of settings.list) {
      if (courier.active !== false) targets.push(courier.id)
    }
  }
  if (settings.mode !== 'private' && settings.groupChatId) {
    targets.push(settings.groupChatId)
  }
  if (!targets.length) return 0

  const text = courierText(order, false)
  const buttons = courierButtons(order)
  const refs: MessageRef[] = []

  for (const chatId of targets) {
    const result = await sendMessage(chatId, text, buttons)
    if (result.ok && result.messageId) {
      refs.push({ chatId, messageId: result.messageId })
    } else if (!result.ok) {
      console.error(`[courier] ${chatId}: ${result.error}`)
    }
  }

  if (refs.length && order.id) {
    await (await adminDb()).collection('orders').doc(String(order.id)).update({ courierMsgs: refs })
  }

  return refs.length
}

/** Barcha kuryer xabarlarini yangi holatga moslab tahrirlaydi. */
async function refreshMessages(order: OrderDoc, revealTo: number | null) {
  const refs: MessageRef[] = Array.isArray(order.courierMsgs)
    ? (order.courierMsgs as MessageRef[])
    : []
  if (!refs.length) return

  const buttons = courierButtons(order)

  for (const ref of refs) {
    // Telefon faqat olgan kuryerning shaxsiy chatida ochiladi.
    // Guruhda — hamma ko'radi, shuning uchun u yerda ham ochamiz:
    // buyurtmani olgandan keyin uni bajarish uchun raqam kerak.
    const reveal = revealTo === null ? Boolean(order.courierId) : true
    const result = await editMessageText(ref.chatId, ref.messageId, courierText(order, reveal), buttons)
    if (!result.ok && !/not modified/i.test(result.error || '')) {
      console.error(`[courier] tahrir ${ref.chatId}/${ref.messageId}: ${result.error}`)
    }
  }
}

// ── Tugma bosilishi ──────────────────────────────────────────

export type CourierActionResult = {
  ok: boolean
  /** Kuryerga ko'rsatiladigan qisqa javob (Telegram alert). */
  alert: string
  /** true — Telegram uni katta oyna qilib chiqaradi. */
  loud?: boolean
}

/**
 * Kuryer tugmasini bosganda chaqiriladi.
 *
 * @param action  'take' — o'ziga olish, 'done' — yetkazildi
 * @param userId  tugmani bosgan odamning Telegram id'si
 */
export async function handleCourierAction(
  action: 'take' | 'done',
  orderId: string,
  userId: number,
): Promise<CourierActionResult> {
  const settings = await readCourierSettings()
  const courier = findCourier(settings, userId)

  // 1. Kuryer emasmi — hech narsa o'zgarmaydi
  if (!courier) {
    return { ok: false, alert: 'Bu tugma faqat kuryer uchun.', loud: true }
  }

  const db = await adminDb()
  const ref = db.collection('orders').doc(orderId)

  // 2. Olishni tranzaksiyada bajaramiz — ikki kuryer bir vaqtda bossa ham
  //    buyurtma faqat bittasiga tegadi.
  let outcome: { alert: string; loud?: boolean; changed: boolean; status?: string } = {
    alert: '',
    changed: false,
  }

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) {
        outcome = { alert: 'Buyurtma topilmadi.', loud: true, changed: false }
        return
      }

      const data = snap.data() || {}
      const status = String(data.status || '')

      if (status === 'Bekor qilingan' || status === 'Rad etildi') {
        outcome = { alert: `Buyurtma ${status.toLowerCase()}.`, loud: true, changed: false }
        return
      }

      if (action === 'take') {
        const owner = Number(data.courierId) || 0
        if (owner && owner !== userId) {
          outcome = {
            alert: `Buyurtmani ${data.courierName || 'boshqa kuryer'} olgan.`,
            loud: true,
            changed: false,
          }
          return
        }
        if (owner === userId) {
          outcome = { alert: 'Bu buyurtma allaqachon sizda.', changed: false }
          return
        }

        tx.update(ref, {
          courierId: userId,
          courierName: courier.name,
          courierPhone: courier.phone || null,
          claimedAt: new Date().toISOString(),
          status: 'Yetkazilmoqda',
          statusUpdatedAt: new Date().toISOString(),
        })
        outcome = { alert: '📦 Buyurtma sizga biriktirildi', changed: true, status: 'Yetkazilmoqda' }
        return
      }

      // action === 'done'
      const owner = Number(data.courierId) || 0
      if (!owner) {
        outcome = { alert: 'Avval «Oldim» tugmasini bosing.', loud: true, changed: false }
        return
      }
      if (owner !== userId) {
        outcome = {
          alert: `Bu buyurtma ${data.courierName || 'boshqa kuryer'}da.`,
          loud: true,
          changed: false,
        }
        return
      }
      if (status === 'Yetkazildi') {
        outcome = { alert: 'Allaqachon yetkazilgan deb belgilangan.', changed: false }
        return
      }

      tx.update(ref, {
        status: 'Yetkazildi',
        deliveredAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString(),
      })
      outcome = { alert: '✅ Yetkazildi deb belgilandi', changed: true, status: 'Yetkazildi' }
    })
  } catch (error) {
    console.error('[courier] tranzaksiya xatosi:', error)
    return { ok: false, alert: 'Xatolik yuz berdi, qayta urining.', loud: true }
  }

  // 3. O'zgarish bo'lgan bo'lsa — xabarlarni yangilaymiz va mijozga yozamiz
  if (outcome.changed) {
    const fresh = await ref.get()
    const order = { ...fresh.data(), id: fresh.id } as OrderDoc

    await refreshMessages(order, userId)
    if (outcome.status) await notifyCustomerStatus(order, outcome.status)
  }

  return { ok: outcome.changed, alert: outcome.alert, loud: outcome.loud }
}

/**
 * Panel yoki admin statusni o'zgartirganda kuryer xabarlarini ham
 * yangilab qo'yadi — aks holda guruhda eskirgan tugma qolib ketadi.
 */
export async function syncCourierMessages(order: OrderDoc) {
  try {
    await refreshMessages(order, null)
  } catch (error) {
    console.error('[courier] xabarlarni yangilab bo‘lmadi:', error)
  }
}

/** Guruhni biriktirish (`/guruh` buyrug'i). */
export async function bindGroup(chatId: number, title: string): Promise<string> {
  const db = await adminDb()
  await db
    .collection('settings')
    .doc(SETTINGS_DOC)
    .set({ groupChatId: chatId, groupTitle: title.slice(0, 120) }, { merge: true })

  return (
    '✅ <b>Guruh biriktirildi.</b>\n\n' +
    'Endi yangi buyurtmalar shu guruhga tushadi. Tugmalarni faqat ' +
    'panelda ro‘yxatga olingan kuryerlar bosa oladi.'
  )
}

/** Guruhda ishlatiladigan yordam matni. */
export function groupHelp(): string {
  return (
    'ℹ️ Bu guruhni buyurtmalar uchun biriktirish uchun <b>admin</b> ' +
    '<code>/guruh</code> deb yozishi kerak.'
  )
}

export { sendMessage }
