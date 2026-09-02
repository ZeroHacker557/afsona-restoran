import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth, adminDb } from './_lib/firebase-admin.js'
import { fail, requirePost } from './_lib/http.js'
import { adjustStock } from './_lib/stock.js'
import { syncCourierMessages } from './_lib/courier.js'
import { notifyCustomerStatus, type OrderDoc } from './_lib/order-notify.js'

/** Faqat shu statuslardagi buyurtmani mijoz bekor qila oladi. */
const CANCELLABLE = ['Yangi', 'Qabul qilindi']

/**
 * POST /api/order-cancel   { orderId }
 * Authorization: Bearer <Firebase ID token>
 *
 * Mijoz o'z buyurtmasini bekor qiladi (5-band).
 *
 * Ilgari "Bekor qilingan" statusiga o'tish yo'li umuman yo'q edi —
 * buyurtmalar sahifasida shu nomli bo'lim bor edi-yu, u abadiy bo'sh
 * turardi.
 *
 * Bekor qilinganda ombor qoldig'i qaytariladi, kuryerlardagi xabar
 * yangilanadi va mijozga tasdiq boradi.
 *
 * MUHIM: mijoz faqat NAQD to'lovdagi buyurtmani o'zi bekor qila oladi.
 * Karta bilan to'langan buyurtmada pul allaqachon o'tkazilgan bo'ladi —
 * uni qaytarish odam qarori, shuning uchun bunday buyurtma faqat
 * operator orqali bekor qilinadi.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return

  const authHeader = String(req.headers.authorization || '')
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!idToken) return fail(res, 401, 'Avtorizatsiya talab qilinadi')

  let uid: string
  try {
    uid = (await (await adminAuth()).verifyIdToken(idToken)).uid
  } catch {
    return fail(res, 401, 'Sessiya eskirgan, ilovani qayta oching')
  }

  const orderId = String(req.body?.orderId ?? '').trim()
  if (!orderId) return fail(res, 400, 'Buyurtma tanlanmagan')

  const db = await adminDb()
  const userId = Number(uid)

  try {
    const result = await db.runTransaction(async (tx) => {
      const orderRef = db.collection('orders').doc(orderId)
      const orderSnap = await tx.get(orderRef)
      if (!orderSnap.exists) throw new Error('NOT_FOUND')

      const order = orderSnap.data() as FirebaseFirestore.DocumentData

      // Faqat o'z buyurtmasi
      if (Number(order.userId) !== userId) throw new Error('NOT_YOURS')

      const status = String(order.status || '')
      if (status === 'Bekor qilingan') throw new Error('ALREADY_CANCELLED')
      if (!CANCELLABLE.includes(status)) throw new Error('TOO_LATE')

      // Karta bilan to'langan buyurtmani mijoz o'zi bekor qila olmaydi:
      // pul qaytarish operator ishtirokini talab qiladi.
      if (String(order.paymentMethod || '') !== 'Naqd') throw new Error('CARD_ORDER')

      // Ombor qoldig'ini qaytaramiz (yozishlardan oldin o'qiladi)
      if (order.stockRestored !== true) {
        await adjustStock(tx, db, order as OrderDoc, 1)
      }

      tx.update(orderRef, {
        status: 'Bekor qilingan',
        cancelledAt: new Date().toISOString(),
        cancelledBy: 'customer',
        stockRestored: true,
      })

      return {
        id: orderId,
        orderNumber: String(order.orderNumber || order.id || ''),
        order: { ...order, id: orderId, status: 'Bekor qilingan' } as OrderDoc,
      }
    })

    /*
       Xabarlar tranzaksiyadan KEYIN ketadi — tashqi so'rov tranzaksiya
       ichida bo'lmasligi kerak (u qayta urinilishi mumkin).

       Ilgari bu yerda hech qanday xabar yo'q edi: kuryer guruhida
       «Oldim» tugmasi turaverardi va mijozga tasdiq kelmasdi.
    */
    try {
      await notifyCustomerStatus(result.order, 'Bekor qilingan')
      await syncCourierMessages(result.order)
    } catch (error) {
      // Buyurtma bekor qilindi — xabar ketmasa ham javob muvaffaqiyatli
      console.error('[order-cancel] xabar yuborilmadi:', error)
    }

    return res.status(200).json({ id: result.id, orderNumber: result.orderNumber })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const messages: Record<string, string> = {
      NOT_FOUND: 'Buyurtma topilmadi',
      NOT_YOURS: 'Bu buyurtma sizniki emas',
      ALREADY_CANCELLED: 'Buyurtma allaqachon bekor qilingan',
      TOO_LATE: "Bu buyurtmani endi bekor qilib bo'lmaydi — operator bilan bog'laning",
      CARD_ORDER:
        "Karta bilan to'langan buyurtmani ilovadan bekor qilib bo'lmaydi — " +
        "iltimos, biz bilan bog'laning",
    }
    if (messages[code]) return fail(res, 400, messages[code])

    console.error('[order-cancel] xato:', error)
    return fail(res, 500, "Bekor qilinmadi, qayta urinib ko'ring")
  }
}
