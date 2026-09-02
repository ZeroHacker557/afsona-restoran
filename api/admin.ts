import { timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth, adminDb } from './_lib/firebase-admin.js'
import { fail, requirePost } from './_lib/http.js'
import {
  ADMINS_DOC,
  allowedAdminEmails,
  envAdminEmails,
  isBotRequest,
  normalizeEmail,
  requireAdmin,
} from './_lib/admin-auth.js'
import { getOpenState, readHours } from './_lib/hours.js'
import { adjustStock, CANCELLED_STATUSES } from './_lib/stock.js'
import {
  bindGroup,
  findCourier,
  handleCourierAction,
  notifyCouriersNewOrder,
  readCourierSettings,
  syncCourierMessages,
} from './_lib/courier.js'
import {
  bindChannel,
  deleteChannelPost,
  expireChannelPost,
  sendChannelPost,
  unbindChannel,
} from './_lib/channel.js'
import { escapeHtml, sendAny, sendMessage } from './_lib/telegram.js'
import {
  displayId,
  miniAppButton,
  notifyChatIds,
  notifyCustomerStatus,
  pushNotification,
  sendOrderLocation,
  type OrderDoc,
} from './_lib/order-notify.js'

/**
 * /api/admin — boshqaruv panelining yagona kirish nuqtasi.
 *
 * Nega bitta funksiya? Vercel bepul rejasida serverless funksiyalar soni
 * cheklangan (12 ta). Har bir amal uchun alohida fayl ochish o'rniga
 * `action` maydoni bo'yicha ichkarida yo'naltiramiz.
 *
 * Panel katalogni (taom, kategoriya, promokod, sozlama) to'g'ridan-to'g'ri
 * Firestore'ga yozadi — qoidalar `admin` claim'ni tekshiradi. Bu yerda esa
 * faqat SERVER SIRI kerak bo'ladigan amallar turadi:
 *   • admin huquqini berish/olib tashlash (custom claim),
 *   • Telegram orqali xabar yuborish (bot tokeni),
 *   • buyurtma statusi — o'zgartirish va mijozga xabar birga ketadi.
 */

const STATUSES = new Set([
  'Yangi',
  'Qabul qilindi',
  'Yetkazilmoqda',
  'Yetkazildi',
  'Bekor qilingan',
  'Rad etildi',
])

const PAYMENT_STATUSES = new Set(['Tolangan', 'Kutilmoqda', 'Rad etildi'])

/** Bir so'rovda nechta odamga xabar yuboriladi (Vercel vaqt chegarasi). */
const BROADCAST_BATCH = 25

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return

  const action = String((req.body as { action?: unknown } | undefined)?.action || '')
  if (!action) return fail(res, 400, 'action ko‘rsatilmagan')

  try {
    // Bu ikkisi admin claim'siz chaqiriladi — ular claim beradi
    if (action === 'session') return await handleSession(req, res)
    if (action === 'seed') return await handleSeed(req, res)

    // Bular bot dasturidan keladi — Firebase Auth emas, maxfiy kalit bilan
    if (action === 'courier.action') return await handleCourierButton(req, res)
    if (action === 'courier.group') return await handleCourierGroup(req, res)
    if (action === 'channel.bind') return await handleChannelBind(req, res)
    if (action === 'bot.info') return await handleBotInfo(req, res)
    if (action === 'bot.user') return await handleBotUser(req, res)
    if (action === 'bot.phone') return await handleBotPhone(req, res)

    const admin = await requireAdmin(req, res)
    if (!admin) return

    switch (action) {
      case 'admins.list':
        return await handleAdminsList(res)
      case 'admins.add':
        return await handleAdminsAdd(req, res)
      case 'admins.remove':
        return await handleAdminsRemove(req, res, admin.email)
      case 'admins.password':
        return await handleAdminsPassword(req, res)
      case 'admins.telegram':
        return await handleAdminsTelegram(req, res)
      case 'broadcast.recipients':
        return await handleRecipients(req, res)
      case 'broadcast.send':
        return await handleBroadcast(req, res)
      case 'order.status':
        return await handleOrderStatus(req, res)
      case 'order.payment':
        return await handleOrderPayment(req, res)
      case 'order.location':
        return await handleOrderLocation(req, res)
      case 'order.delete':
        return await handleOrderDelete(req, res)
      case 'notify.user':
        return await handleNotifyUser(req, res)
      case 'channel.post':
        return await handleChannelPost(req, res)
      case 'channel.expire':
        return await handleChannelExpire(req, res)
      case 'channel.delete':
        return await handleChannelDelete(req, res)
      case 'channel.unbind':
        return await handleChannelUnbind(res)
      default:
        return fail(res, 400, `Noma‘lum action: ${action}`)
    }
  } catch (error) {
    console.error(`[admin:${action}] xato:`, error)
    return fail(res, 500, error instanceof Error ? error.message : 'Server xatosi')
  }
}

// ── Sessiya ──────────────────────────────────────────────────

/**
 * Kirgan foydalanuvchini tekshiradi va kerak bo'lsa `admin: true` claim'ini
 * qo'yadi. Panel keyin tokenni majburan yangilaydi (getIdToken(true)).
 */
async function handleSession(req: VercelRequest, res: VercelResponse) {
  const header = req.headers.authorization || ''
  const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!idToken) return fail(res, 401, 'Token yo‘q')

  const auth = await adminAuth()

  let decoded
  try {
    decoded = await auth.verifyIdToken(idToken, true)
  } catch {
    return fail(res, 401, 'Sessiya eskirgan, qaytadan kiring')
  }

  const email = normalizeEmail(decoded.email)
  const allowed = await allowedAdminEmails()

  if (!allowed.has(email)) {
    // Ro'yxatdan chiqarilgan bo'lsa — huquqni ham olib tashlaymiz
    if (decoded.admin === true) {
      await auth.setCustomUserClaims(decoded.uid, {})
      await auth.revokeRefreshTokens(decoded.uid)
    }
    return fail(res, 403, 'Bu email admin ro‘yxatida yo‘q')
  }

  let refreshed = false
  if (decoded.admin !== true) {
    await auth.setCustomUserClaims(decoded.uid, { admin: true })
    refreshed = true
  }

  return res.status(200).json({ ok: true, email, admin: true, refreshed })
}

/**
 * BIRINCHI adminni yaratadi — bir martalik ishga tushirish amali.
 *
 * Bu amal `requireAdmin` dan oldin ishlaydi, uni faqat ADMIN_SETUP_KEY
 * himoya qiladi. Shuning uchun uchta cheklov qo'yilgan:
 *
 *  1. Admin allaqachon mavjud bo'lsa — umuman rad etiladi. Ilgari bu
 *     amal mavjud foydalanuvchining PAROLINI ALMASHTIRA olardi: kalitni
 *     bilgan odam eganing hisobini egallab olishi mumkin edi.
 *  2. Kalit doimiy vaqtda solishtiriladi (vaqt bo'yicha sizib chiqmasin).
 *  3. Ketma-ket noto'g'ri urinishlar sekinlashtiriladi — kalitni tanlab
 *     ko'rish amaliy bo'lmaydi.
 *
 * Parolni tiklash uchun endi Firebase Console yoki paneldagi
 * «Adminlar → parolni o'zgartirish» ishlatiladi.
 */
let seedFailures = 0
let seedBlockedUntil = 0

async function handleSeed(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { key?: string; email?: string; password?: string }
  const expected = process.env.ADMIN_SETUP_KEY

  if (!expected) return fail(res, 500, 'ADMIN_SETUP_KEY sozlanmagan')

  if (Date.now() < seedBlockedUntil) {
    return fail(res, 429, 'Juda ko‘p urinish. Biroz kutib, qayta urining')
  }

  const given = String(body?.key || '')
  const ok =
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected))

  if (!ok) {
    seedFailures++
    // Uchtadan keyin — bir daqiqa kutish
    if (seedFailures >= 3) seedBlockedUntil = Date.now() + 60_000
    return fail(res, 403, 'Kalit noto‘g‘ri')
  }
  seedFailures = 0

  // Eng muhim cheklov: admin bor bo'lsa, bu yo'l yopiq
  const existing = await allowedAdminEmails()
  if (existing.size > 0) {
    return fail(
      res,
      409,
      'Admin allaqachon mavjud. Yangi admin qo‘shish uchun panelga kiring: /admin → Adminlar',
    )
  }

  const email = normalizeEmail(body?.email)
  const password = String(body?.password || '')
  if (!email.includes('@')) return fail(res, 400, 'Email noto‘g‘ri')
  if (password.length < 8) return fail(res, 400, 'Parol kamida 8 belgidan iborat bo‘lsin')

  const uid = await upsertAuthUser(email, password)
  await addAdminEmail(email)
  await (await adminAuth()).setCustomUserClaims(uid, { admin: true })

  return res.status(200).json({ ok: true, email })
}

// ── Adminlar ─────────────────────────────────────────────────

async function adminsDocRef() {
  return (await adminDb()).collection(ADMINS_DOC.collection).doc(ADMINS_DOC.doc)
}

async function upsertAuthUser(email: string, password: string): Promise<string> {
  const auth = await adminAuth()
  try {
    const user = await auth.getUserByEmail(email)
    if (password) await auth.updateUser(user.uid, { password })
    return user.uid
  } catch {
    const created = await auth.createUser({ email, password, emailVerified: true })
    return created.uid
  }
}

async function addAdminEmail(email: string) {
  const ref = await adminsDocRef()
  const snap = await ref.get()
  const emails: string[] = Array.isArray(snap.data()?.emails) ? snap.data()!.emails : []
  if (!emails.map(normalizeEmail).includes(email)) {
    await ref.set({ emails: [...emails, email] }, { merge: true })
  }
}

async function handleAdminsList(res: VercelResponse) {
  const snap = await (await adminsDocRef()).get()
  const data = snap.exists ? snap.data() || {} : {}
  const owners = envAdminEmails()
  const emails = Array.isArray(data.emails) ? data.emails.map(normalizeEmail) : []
  const ids = Array.isArray(data.ids) ? data.ids.map(Number).filter(Number.isFinite) : []

  return res.status(200).json({
    ok: true,
    owners,
    emails: [...new Set([...owners, ...emails])],
    telegramIds: ids,
  })
}

async function handleAdminsAdd(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { email?: string; password?: string }
  const email = normalizeEmail(body?.email)
  const password = String(body?.password || '')

  if (!email.includes('@')) return fail(res, 400, 'Email noto‘g‘ri')
  if (password.length < 8) return fail(res, 400, 'Parol kamida 8 belgidan iborat bo‘lsin')

  const uid = await upsertAuthUser(email, password)
  await addAdminEmail(email)
  await (await adminAuth()).setCustomUserClaims(uid, { admin: true })

  return res.status(200).json({ ok: true, email })
}

async function handleAdminsRemove(req: VercelRequest, res: VercelResponse, actor: string) {
  const email = normalizeEmail((req.body as { email?: string })?.email)
  if (!email) return fail(res, 400, 'Email yo‘q')
  if (email === actor) return fail(res, 400, 'O‘zingizni o‘chira olmaysiz')
  if (envAdminEmails().includes(email)) {
    return fail(res, 400, 'Egani (ADMIN_EMAILS) paneldan o‘chirib bo‘lmaydi')
  }

  const ref = await adminsDocRef()
  const snap = await ref.get()
  const emails: string[] = Array.isArray(snap.data()?.emails) ? snap.data()!.emails : []
  await ref.set({ emails: emails.filter((item) => normalizeEmail(item) !== email) }, { merge: true })

  // Huquqni darhol bekor qilamiz — eski token bilan kira olmasin
  const auth = await adminAuth()
  try {
    const user = await auth.getUserByEmail(email)
    await auth.setCustomUserClaims(user.uid, {})
    await auth.revokeRefreshTokens(user.uid)
  } catch {
    /* Auth'da bo'lmasa ham ro'yxatdan chiqdi */
  }

  return res.status(200).json({ ok: true })
}

async function handleAdminsPassword(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { email?: string; password?: string }
  const email = normalizeEmail(body?.email)
  const password = String(body?.password || '')
  if (password.length < 8) return fail(res, 400, 'Parol kamida 8 belgidan iborat bo‘lsin')
  if (!(await allowedAdminEmails()).has(email)) return fail(res, 400, 'Bunday admin yo‘q')

  await upsertAuthUser(email, password)
  return res.status(200).json({ ok: true })
}

/** Buyurtma xabarnomasi keladigan Telegram ID'lari. */
async function handleAdminsTelegram(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { mode?: string; id?: number | string }
  const id = Number(body?.id)
  if (!Number.isFinite(id) || id === 0) return fail(res, 400, 'Telegram ID noto‘g‘ri')

  const ref = await adminsDocRef()
  const snap = await ref.get()
  const ids: number[] = Array.isArray(snap.data()?.ids) ? snap.data()!.ids.map(Number) : []

  const next =
    body?.mode === 'remove' ? ids.filter((item) => item !== id) : [...new Set([...ids, id])]

  await ref.set({ ids: next }, { merge: true })

  if (body?.mode !== 'remove') {
    await sendMessage(
      id,
      '✅ <b>Siz endi buyurtma xabarnomalarini olasiz.</b>\n\nYangi buyurtma kelganda shu chatga xabar keladi.',
    )
  }

  return res.status(200).json({ ok: true, telegramIds: next })
}

// ── Xabarnoma (broadcast) ────────────────────────────────────

type Segment = 'all' | 'active7' | 'inactive30' | 'buyers' | 'nonbuyers'

/**
 * Segment bo'yicha qabul qiluvchilar ro'yxati.
 * Ro'yxatni panel oladi va paketlab yuborishni o'zi boshqaradi — shunda
 * progress ko'rinadi va funksiya vaqt chegarasiga tushmaydi.
 */
async function handleRecipients(req: VercelRequest, res: VercelResponse) {
  const segment = String((req.body as { segment?: string })?.segment || 'all') as Segment
  const db = await adminDb()

  const DAY = 24 * 60 * 60 * 1000
  const cutoff = (days: number) => new Date(Date.now() - days * DAY).toISOString()

  /*
     Segmentni imkon qadar FIRESTORE hisoblaydi, kod emas.

     Ilgari bu funksiya butun `users` kolleksiyasini to'liq hujjatlari
     bilan o'qir, «xarid qilganlar» segmentida esa ustiga BUTUN `orders`
     kolleksiyasini ham o'qirdi. Buyurtmalar eng tez o'sadigan to'plam —
     1000 mijoz va 10 000 buyurtmada bu bitta tugma bosish uchun 11 000
     o'qish degani edi.

     Endi:
       • buyurtmalar umuman o'qilmaydi — mijozda `hasOrders` bayrog'i bor
         (`api/orders.ts` uni buyurtma yaratilganda qo'yadi);
       • faollik sanasi so'rovda filtrlanadi (bitta maydon — indeks
         avtomatik);
       • hujjatdan faqat kerakli maydonlar olinadi (`select`), ya'ni
         ism, rasm va manzillar umuman tashilmaydi.
  */
  let query: FirebaseFirestore.Query = db.collection('users')

  if (segment === 'active7') {
    query = query.where('lastActive', '>=', cutoff(7))
  } else if (segment === 'inactive30') {
    query = query.where('lastActive', '<', cutoff(30))
  } else if (segment === 'buyers') {
    query = query.where('hasOrders', '==', true)
  }
  // `nonbuyers` — Firestore "maydon yo'q" ni tenglik bilan topa olmaydi,
  // shuning uchun u faqat shu segmentda kodda filtrlanadi.

  const usersSnap = await query.select('id', 'hasOrders').get()

  const ids: number[] = []
  usersSnap.forEach((doc) => {
    const data = doc.data() || {}
    const id = Number(data.id ?? doc.id)
    if (!Number.isFinite(id) || id === 0) return
    if (segment === 'nonbuyers' && data.hasOrders === true) return
    ids.push(id)
  })

  return res.status(200).json({ ok: true, segment, count: ids.length, ids })
}

/** Bitta paketni yuboradi. Panel qolgan paketlarni ketma-ket chaqiradi. */
async function handleBroadcast(req: VercelRequest, res: VercelResponse) {
  const body = req.body as {
    chatIds?: (number | string)[]
    text?: string
    photoUrl?: string
    videoUrl?: string
    buttonText?: string
    buttonUrl?: string
    saveInApp?: boolean
    title?: string
  }

  const chatIds = (Array.isArray(body?.chatIds) ? body.chatIds : [])
    .map(Number)
    .filter((id) => Number.isFinite(id) && id !== 0)
    .slice(0, BROADCAST_BATCH)

  const text = String(body?.text || '').slice(0, 3500)
  const photoUrl = body?.photoUrl ? String(body.photoUrl) : undefined
  const videoUrl = body?.videoUrl ? String(body.videoUrl) : undefined

  if (!chatIds.length) return fail(res, 400, 'Qabul qiluvchilar yo‘q')
  if (!text && !photoUrl && !videoUrl) return fail(res, 400, 'Xabar bo‘sh')

  // Admin qo'lda tugma qo'ysa — oddiy havola. Lekin havola mini app'niki
  // bo'lsa, uni Telegram ichida ochadigan tugma qilamiz.
  const miniAppUrl = process.env.MINI_APP_URL || ''
  const customUrl = body?.buttonUrl ? String(body.buttonUrl) : ''
  const buttons =
    body?.buttonText && customUrl
      ? [
          {
            text: String(body.buttonText).slice(0, 40),
            url: customUrl,
            miniApp: Boolean(miniAppUrl) && customUrl.startsWith(miniAppUrl),
          },
        ]
      : miniAppButton()

  let sent = 0
  let blocked = 0
  const failed: number[] = []

  for (const chatId of chatIds) {
    const result = await sendAny(chatId, { text, photoUrl, videoUrl, buttons })
    if (result.ok) {
      sent++
      if (body?.saveInApp) {
        await pushNotification(
          chatId,
          String(body?.title || '📢 Yangilik'),
          text.replace(/<[^>]+>/g, '').slice(0, 500),
          'promo',
        )
      }
    } else if (result.blocked) {
      blocked++
    } else {
      failed.push(chatId)
    }
  }

  return res.status(200).json({ ok: true, sent, blocked, failed })
}

async function handleNotifyUser(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { userId?: number | string; text?: string; title?: string }
  const userId = Number(body?.userId)
  const text = String(body?.text || '').trim().slice(0, 3500)

  if (!Number.isFinite(userId) || userId === 0) return fail(res, 400, 'Foydalanuvchi noto‘g‘ri')
  if (!text) return fail(res, 400, 'Xabar bo‘sh')

  const result = await sendMessage(userId, text, miniAppButton())
  await pushNotification(
    userId,
    String(body?.title || '💬 Xabar'),
    text.replace(/<[^>]+>/g, ''),
    'system',
  )

  return res.status(200).json({ ok: result.ok, error: result.error })
}

// ── Buyurtmalar ──────────────────────────────────────────────

async function loadOrder(orderId: string) {
  const db = await adminDb()
  const ref = db.collection('orders').doc(orderId)
  const snap = await ref.get()
  return snap.exists ? { ref, data: { ...snap.data(), id: snap.id } as OrderDoc } : null
}

async function handleOrderStatus(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { orderId?: string; status?: string; cancelReason?: string }
  const orderId = String(body?.orderId || '')
  const status = String(body?.status || '')
  // Sabab faqat bekor qilishda ma'noga ega. Uzunligini cheklaymiz —
  // bu matn mijozga Telegram xabarida ko'rinadi.
  const cancelReason = String(body?.cancelReason || '').trim().slice(0, 160)

  if (!orderId) return fail(res, 400, 'Buyurtma ko‘rsatilmagan')
  if (!STATUSES.has(status)) return fail(res, 400, 'Status noto‘g‘ri')

  const order = await loadOrder(orderId)
  if (!order) return fail(res, 404, 'Buyurtma topilmadi')

  const cancelled = CANCELLED_STATUSES.has(status)
  const wasCancelled = CANCELLED_STATUSES.has(String(order.data.status || ''))
  const restoredBefore = order.data.stockRestored === true

  /*
     Status o'zgarishi va ombor qoldig'i BIR tranzaksiyada bo'ladi.

     Ilgari bekor qilinganda qoldiq qaytarilmasdi (buni faqat mijozning
     o'z bekor qilishi qilardi). Natijada har bekor qilingan buyurtma
     qoldiqni yeb ketardi va taom oxir-oqibat o'zi stop-listga tushib,
     sotuvdan chiqib qolardi — restoran esa sababini bilmasdi.

     `stockRestored` bayrog'i ikki tomonlama hisobni to'sadi: qoldiq bir
     marta qaytariladi, buyurtma bekor holatidan qaytarilsa — qaytadan
     kamaytiriladi.
  */
  const db = await adminDb()
  await db.runTransaction(async (tx) => {
    // Firestore qoidasi: barcha o'qishlar yozishlardan oldin
    let restoredNow = restoredBefore
    if (cancelled && !restoredBefore) {
      await adjustStock(tx, db, order.data, 1)
      restoredNow = true
    } else if (!cancelled && wasCancelled && restoredBefore) {
      await adjustStock(tx, db, order.data, -1)
      restoredNow = false
    }

    tx.update(order.ref, {
      status,
      statusUpdatedAt: new Date().toISOString(),
      // Statusdan qaytib chiqilsa eski sabab qolib ketmasin
      cancelReason: cancelled ? cancelReason : '',
      stockRestored: restoredNow,
    })

    /*
       Buyurtma yetkazilgach, mijoz nimani sotib olganini belgilab
       qo'yamiz: `users/{id}/purchased/{taomId}`.

       Bu sharh qoldirish huquqini tekshirish uchun kerak. Busiz
       `api/reviews.ts` mijozning BARCHA yetkazilgan buyurtmalarini
       o'qib chiqishga majbur edi — endi bitta hujjat yetarli.
    */
    const userId = Number(order.data.userId)
    if (status === 'Yetkazildi' && userId) {
      const userRef = db.collection('users').doc(String(userId))
      const items = Array.isArray(order.data.products) ? order.data.products : []
      const seen = new Set<string>()

      for (const item of items) {
        const productId = String((item?.product as { id?: unknown } | undefined)?.id ?? '').trim()
        if (!productId || seen.has(productId)) continue
        seen.add(productId)
        tx.set(
          userRef.collection('purchased').doc(productId),
          { productId, at: new Date().toISOString() },
          { merge: true },
        )
      }
    }
  })

  const updated = { ...order.data, status, cancelReason: cancelled ? cancelReason : '' }
  await notifyCustomerStatus(updated, status)

  /*
     Kuryerlarga xabar ayni shu yerda — buyurtma yaratilganda emas — ketadi.

     Nega: ilgari buyurtma tushishi bilan guruhga tugmasiz xabar borar,
     admin tasdiqlagach esa o'sha xabar TAHRIRLANARDI. Telegram tahrir
     uchun bildirishnoma bermaydi, shuning uchun «Oldim» tugmasi chatning
     yuqorisida jimgina paydo bo'lardi va kuryer ko'rmay qolardi.

     Endi xabar birinchi marta aynan ish boshlanadigan paytda, yangi
     xabar sifatida yuboriladi — ovoz chiqadi. Bekor qilingan buyurtma
     esa kuryerlarni umuman bezovta qilmaydi.
  */
  const alreadySent = Array.isArray(order.data.courierMsgs) && order.data.courierMsgs.length > 0
  const actionable = status !== 'Yangi' && !cancelled

  if (!alreadySent && actionable) {
    const sent = await notifyCouriersNewOrder(updated)
    if (sent > 0) await order.ref.update({ notified: true })
  } else {
    // Xabar allaqachon ketgan — eskirgan tugma qolmasin
    await syncCourierMessages(updated)
  }

  return res.status(200).json({ ok: true })
}

async function handleOrderPayment(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { orderId?: string; paymentStatus?: string }
  const orderId = String(body?.orderId || '')
  const paymentStatus = String(body?.paymentStatus || '')

  if (!orderId) return fail(res, 400, 'Buyurtma ko‘rsatilmagan')
  if (!PAYMENT_STATUSES.has(paymentStatus)) return fail(res, 400, 'To‘lov holati noto‘g‘ri')

  const order = await loadOrder(orderId)
  if (!order) return fail(res, 404, 'Buyurtma topilmadi')

  await order.ref.update({ paymentStatus })

  const userId = Number(order.data.userId)
  if (userId) {
    const id = displayId(order.data)
    if (paymentStatus === 'Tolangan') {
      await sendMessage(
        userId,
        `✅ <b>To'lovingiz tasdiqlandi!</b>\n\n🆔 Buyurtma: <b>${escapeHtml(id)}</b>\n\nBuyurtmangiz tayyorlanmoqda.`,
        miniAppButton(),
      )
      await pushNotification(userId, "✅ To'lov tasdiqlandi", `${id} buyurtmangiz to'lovi tasdiqlandi.`)
    } else if (paymentStatus === 'Rad etildi') {
      await sendMessage(
        userId,
        `❌ <b>To'lov tasdiqlanmadi.</b>\n\n🆔 Buyurtma: <b>${escapeHtml(id)}</b>\n\nIltimos, chekni qaytadan yuboring yoki biz bilan bog'laning.`,
        miniAppButton(),
      )
      await pushNotification(userId, "❌ To'lov tasdiqlanmadi", `${id} buyurtmangiz to'lovi rad etildi.`)
    }
  }

  return res.status(200).json({ ok: true })
}

/**
 * Buyurtma manzilini adminlarning Telegram chatiga yuboradi:
 * avval xarita nuqtasi (lokatsiya), ketidan mijoz va taomlar ro'yxati.
 * Shu xabarni kuryerga to'g'ridan-to'g'ri uzatish mumkin.
 */
async function handleOrderLocation(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { orderId?: string; chatId?: number | string }
  const orderId = String(body?.orderId || '')
  if (!orderId) return fail(res, 400, 'Buyurtma ko‘rsatilmagan')

  const order = await loadOrder(orderId)
  if (!order) return fail(res, 404, 'Buyurtma topilmadi')

  // Aniq chat ko'rsatilsa — o'shanga, aks holda barcha adminlarga
  const single = Number(body?.chatId)
  const chatIds = Number.isFinite(single) && single !== 0 ? [single] : await notifyChatIds()

  const result = await sendOrderLocation(order.data, chatIds)
  if (!result.sent) return fail(res, 400, result.error || 'Yuborilmadi')

  return res.status(200).json({ ok: true, sent: result.sent })
}

async function handleOrderDelete(req: VercelRequest, res: VercelResponse) {
  const orderId = String((req.body as { orderId?: string })?.orderId || '')
  if (!orderId) return fail(res, 400, 'Buyurtma ko‘rsatilmagan')

  await (await adminDb()).collection('orders').doc(orderId).delete()
  return res.status(200).json({ ok: true })
}

// ── Kuryer tugmalari (bot orqali) ────────────────────────────

/**
 * Bot kuryerning tugma bosganini shu yerga uzatadi. Butun tekshiruv va
 * status o'zgarishi shu yerda bo'ladi — bot hech narsa hal qilmaydi.
 */
async function handleCourierButton(req: VercelRequest, res: VercelResponse) {
  if (!isBotRequest(req)) return fail(res, 403, 'Ruxsat yo‘q')

  const body = req.body as {
    orderId?: string
    userId?: number | string
    chatId?: number | string
    act?: string
  }
  const orderId = String(body?.orderId || '')
  const userId = Number(body?.userId)
  const act = body?.act

  if (!orderId || !act) return fail(res, 400, 'So‘rov to‘liq emas')
  if (!Number.isFinite(userId) || userId === 0) return fail(res, 400, 'Foydalanuvchi noto‘g‘ri')

  // Lokatsiya so'rovi: kuryer ham, admin ham olishi mumkin
  if (act === 'loc') {
    const chatId = Number(body?.chatId)
    if (!Number.isFinite(chatId) || chatId === 0) return fail(res, 400, 'Chat noto‘g‘ri')

    const settings = await readCourierSettings()
    const admins = await notifyChatIds()
    if (!findCourier(settings, userId) && !admins.includes(userId)) {
      return res.status(200).json({ ok: false, alert: 'Ruxsat yo‘q.', loud: true })
    }

    const order = await loadOrder(orderId)
    if (!order) return res.status(200).json({ ok: false, alert: 'Buyurtma topilmadi.', loud: true })

    const result = await sendOrderLocation(order.data, [chatId])
    return res.status(200).json(
      result.sent
        ? { ok: true, alert: '📍 Yuborildi' }
        : { ok: false, alert: result.error || 'Yuborilmadi', loud: true },
    )
  }

  if (act !== 'take' && act !== 'done') return fail(res, 400, 'Noma‘lum amal')

  const result = await handleCourierAction(act, orderId, userId)
  return res.status(200).json(result)
}

/*
   ── Bot uchun ma'lumot ────────────────────────────────────

   Bot ilgari Firestore'ga TO'G'RIDAN-TO'G'RI murojaat qilardi va shu
   sababli unga Firebase service account kaliti kerak bo'lardi — ya'ni
   butun bazaga to'liq huquq beruvchi kalit bot serverida (Railway)
   turardi.

   Aslida botga atigi uchta narsa kerak edi: restoran aloqasi, ish vaqti
   va foydalanuvchi telefoni. Ular endi shu API orqali beriladi, bot esa
   Firebase'ni umuman bilmaydi.
*/

/** Restoran ma'lumoti va ish vaqti — bot xabarlari uchun. */
async function handleBotInfo(req: VercelRequest, res: VercelResponse) {
  if (!isBotRequest(req)) return fail(res, 403, 'Ruxsat yo‘q')

  const db = await adminDb()
  const [brandSnap, hoursSnap] = await Promise.all([
    db.collection('settings').doc('brand').get(),
    db.collection('settings').doc('hours').get(),
  ])

  const hours = readHours(hoursSnap.data())
  const state = getOpenState(hours)

  return res.status(200).json({
    ok: true,
    brand: brandSnap.data() || {},
    hours: {
      enabled: hours.enabled,
      temporarilyClosed: hours.temporarilyClosed,
      open: state.open,
      todayText: state.todayText,
    },
  })
}

/** Foydalanuvchi profili — bot telefon saqlanganini bilishi uchun. */
async function handleBotUser(req: VercelRequest, res: VercelResponse) {
  if (!isBotRequest(req)) return fail(res, 403, 'Ruxsat yo‘q')

  const userId = Number((req.body as { userId?: number | string })?.userId)
  if (!Number.isFinite(userId) || userId === 0) return fail(res, 400, 'Foydalanuvchi noto‘g‘ri')

  const snap = await (await adminDb()).collection('users').doc(String(userId)).get()
  const data = snap.exists ? snap.data() || {} : {}

  // Botga faqat kerakli maydonlar beriladi
  return res.status(200).json({
    ok: true,
    exists: snap.exists,
    phone: data.phone ? String(data.phone) : null,
    firstName: data.first_name ? String(data.first_name) : null,
  })
}

/** Telefon raqamini saqlaydi (bot kontakt tugmasi orqali oladi). */
async function handleBotPhone(req: VercelRequest, res: VercelResponse) {
  if (!isBotRequest(req)) return fail(res, 403, 'Ruxsat yo‘q')

  const body = req.body as { userId?: number | string; phone?: string }
  const userId = Number(body?.userId)
  const phone = String(body?.phone || '').trim().slice(0, 40)

  if (!Number.isFinite(userId) || userId === 0) return fail(res, 400, 'Foydalanuvchi noto‘g‘ri')
  if (!phone) return fail(res, 400, 'Raqam bo‘sh')

  await (await adminDb())
    .collection('users')
    .doc(String(userId))
    .set({ id: userId, phone }, { merge: true })

  return res.status(200).json({ ok: true, phone })
}

/** `/guruh` buyrug'i — xodimlar guruhini biriktiradi. */
async function handleCourierGroup(req: VercelRequest, res: VercelResponse) {
  if (!isBotRequest(req)) return fail(res, 403, 'Ruxsat yo‘q')

  const body = req.body as { chatId?: number | string; title?: string; userId?: number | string }
  const chatId = Number(body?.chatId)
  const userId = Number(body?.userId)

  if (!Number.isFinite(chatId) || chatId === 0) return fail(res, 400, 'Guruh noto‘g‘ri')

  // Guruhni faqat admin biriktira oladi
  const admins = await notifyChatIds()
  if (!admins.includes(userId)) {
    return res.status(200).json({
      ok: false,
      text: '⛔ Guruhni faqat administrator biriktira oladi.',
    })
  }

  const text = await bindGroup(chatId, String(body?.title || ''))
  return res.status(200).json({ ok: true, text })
}

// ── Kanal ────────────────────────────────────────────────────

/**
 * Bot kanalga administrator qilib qo'shilganda bot shu yerga xabar
 * beradi. Admin hech qanday buyruq yozmaydi — kanal o'zi biriktiriladi.
 */
async function handleChannelBind(req: VercelRequest, res: VercelResponse) {
  if (!isBotRequest(req)) return fail(res, 403, 'Ruxsat yo‘q')

  const body = req.body as {
    chatId?: number | string
    title?: string
    username?: string
    userId?: number | string
  }
  const chatId = Number(body?.chatId)
  const userId = Number(body?.userId)

  if (!Number.isFinite(chatId) || chatId === 0) return fail(res, 400, 'Kanal noto‘g‘ri')

  // Kanalni faqat panel adminlari biriktira oladi
  const admins = await notifyChatIds()
  if (admins.length && !admins.includes(userId)) {
    return res.status(200).json({ ok: false, error: 'Ruxsat yo‘q' })
  }

  await bindChannel(chatId, String(body?.title || ''), String(body?.username || ''))
  return res.status(200).json({ ok: true })
}

async function handleChannelPost(req: VercelRequest, res: VercelResponse) {
  const body = req.body as {
    text?: string
    photoUrl?: string
    videoUrl?: string
    buttonText?: string
    buttonUrl?: string
    silent?: boolean
    productId?: string
  }

  const result = await sendChannelPost({
    text: String(body?.text || ''),
    photoUrl: body?.photoUrl ? String(body.photoUrl) : undefined,
    videoUrl: body?.videoUrl ? String(body.videoUrl) : undefined,
    buttonText: body?.buttonText ? String(body.buttonText) : undefined,
    buttonUrl: body?.buttonUrl ? String(body.buttonUrl) : undefined,
    silent: Boolean(body?.silent),
    productId: body?.productId ? String(body.productId) : undefined,
  })

  if (!result.ok) return fail(res, 400, result.error || 'Yuborilmadi')
  return res.status(200).json(result)
}

async function handleChannelExpire(req: VercelRequest, res: VercelResponse) {
  const postId = String((req.body as { postId?: string })?.postId || '')
  if (!postId) return fail(res, 400, 'Post ko‘rsatilmagan')

  const result = await expireChannelPost(postId)
  if (!result.ok) return fail(res, 400, result.error || 'Bajarilmadi')
  return res.status(200).json(result)
}

async function handleChannelDelete(req: VercelRequest, res: VercelResponse) {
  const postId = String((req.body as { postId?: string })?.postId || '')
  if (!postId) return fail(res, 400, 'Post ko‘rsatilmagan')

  const result = await deleteChannelPost(postId)
  if (!result.ok) return fail(res, 400, result.error || 'Bajarilmadi')
  return res.status(200).json(result)
}

async function handleChannelUnbind(res: VercelResponse) {
  await unbindChannel()
  return res.status(200).json({ ok: true })
}
