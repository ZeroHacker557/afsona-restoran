import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth, adminDb } from './_lib/firebase-admin.js'
import { fail, requirePost } from './_lib/http.js'

/** Kuzatiladigan hodisalar. Boshqasi qabul qilinmaydi. */
const EVENTS = ['view', 'cart_add', 'checkout_start'] as const
type TrackEvent = (typeof EVENTS)[number]

/**
 * POST /api/track   { event, productId? }
 * Authorization: Bearer <Firebase ID token>
 *
 * Yengil analitika (12-band).
 *
 * Har bir hodisa uchun alohida hujjat yozilmaydi — bu qimmat bo'lardi.
 * O'rniga `analytics/products/items/{productId}` hujjatidagi
 * hisoblagichlar oshiriladi (increment). Kunlik yig'indi ham
 * `analytics/daily/days/{sana}` da saqlanadi.
 *
 * Mijoz bir mahsulotni bir seansda bir marta sanaydi — takroriy
 * so'rovlar mijoz tomonida to'siladi.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return

  const authHeader = String(req.headers.authorization || '')
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!idToken) return fail(res, 401, 'Avtorizatsiya talab qilinadi')

  try {
    await (await adminAuth()).verifyIdToken(idToken)
  } catch {
    return fail(res, 401, 'Sessiya eskirgan')
  }

  const event = String(req.body?.event ?? '') as TrackEvent
  if (!EVENTS.includes(event)) return fail(res, 400, "Noma'lum hodisa")

  const productId = req.body?.productId ? String(req.body.productId).slice(0, 64) : null

  try {
    const db = await adminDb()
    const { FieldValue } = await import('firebase-admin/firestore')
    const today = new Date().toISOString().slice(0, 10)

    const writes: Promise<unknown>[] = []

    // Kunlik yig'indi
    writes.push(
      db.collection('analytics').doc('daily').collection('days').doc(today).set(
        { [event]: FieldValue.increment(1), date: today },
        { merge: true },
      ),
    )

    // Mahsulot bo'yicha
    if (productId) {
      writes.push(
        db.collection('analytics').doc('products').collection('items').doc(productId).set(
          { [event]: FieldValue.increment(1), productId },
          { merge: true },
        ),
      )
    }

    await Promise.all(writes)
    return res.status(200).json({ ok: true })
  } catch (error) {
    // Analitika hech qachon foydalanuvchiga xalaqit bermasin
    console.error('[track] xato:', error)
    return res.status(200).json({ ok: false })
  }
}
