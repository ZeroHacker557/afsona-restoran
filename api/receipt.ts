import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth, adminDb } from './_lib/firebase-admin.js'
import { fail, requirePost } from './_lib/http.js'
import { escapeHtml, sendPhoto } from './_lib/telegram.js'
import { displayId, money, notifyChatIds, type OrderDoc } from './_lib/order-notify.js'

/**
 * POST /api/receipt   { orderId, url }
 * Authorization: Bearer <Firebase ID token>
 *
 * Karta bilan to'lovda mijoz chek rasmini ILOVA ICHIDA yuklaydi
 * (avval buning uchun botga o'tish kerak edi). Rasm Firebase Storage'ga
 * tushadi, bu yerda esa faqat havola buyurtmaga bog'lanadi va adminlarga
 * xabar ketadi. Chek admin panelidagi buyurtma oynasida ko'rinadi.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return

  const header = String(req.headers.authorization || '')
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!idToken) return fail(res, 401, 'Avtorizatsiya talab qilinadi')

  let uid: string
  try {
    uid = (await (await adminAuth()).verifyIdToken(idToken)).uid
  } catch {
    return fail(res, 401, 'Sessiya eskirgan, ilovani qayta oching')
  }

  const body = req.body as { orderId?: string; url?: string }
  const orderId = String(body?.orderId || '')
  const url = String(body?.url || '')

  if (!orderId) return fail(res, 400, 'Buyurtma ko‘rsatilmagan')

  // Faqat o'z Storage'imizdagi havola qabul qilinadi — aks holda
  // buyurtmaga istalgan tashqi manzilni yopishtirib bo'lardi.
  if (!/^https:\/\/firebasestorage\.googleapis\.com\//.test(url)) {
    return fail(res, 400, 'Havola noto‘g‘ri')
  }

  try {
    const db = await adminDb()
    const ref = db.collection('orders').doc(orderId)
    const snap = await ref.get()

    if (!snap.exists) return fail(res, 404, 'Buyurtma topilmadi')

    const order = snap.data() as OrderDoc
    if (Number(order.userId) !== Number(uid)) return fail(res, 403, 'Bu buyurtma sizniki emas')

    await ref.update({
      receiptUrl: url,
      receiptAt: new Date().toISOString(),
      paymentStatus: 'Kutilmoqda',
    })

    // Adminlarga chek rasmini yuboramiz
    const id = displayId({ ...order, id: snap.id })
    const caption =
      '🧾 <b>To‘lov cheki keldi</b>\n' +
      `🆔 Buyurtma: <b>${escapeHtml(id)}</b>\n` +
      `👤 ${escapeHtml(order.customer?.name || '')}\n` +
      `💰 ${money(order.total)}\n\n` +
      'Tasdiqlash uchun admin panelini oching.'

    const chatIds = await notifyChatIds()
    await Promise.all(chatIds.map((chatId) => sendPhoto(chatId, url, caption)))

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('[receipt] xato:', error)
    return fail(res, 500, 'Chek saqlanmadi, qayta urinib ko‘ring')
  }
}
