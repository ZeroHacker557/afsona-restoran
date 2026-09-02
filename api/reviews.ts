import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth, adminDb } from './_lib/firebase-admin.js'
import { fail, requirePost } from './_lib/http.js'

const MAX_COMMENT = 1000

/**
 * POST /api/reviews   { productId, rating, comment }
 * Authorization: Bearer <Firebase ID token>
 *
 * Sharhni SERVER yaratadi, chunki ikkita qoida bor:
 *
 *  1. Sharh qoldirish uchun mahsulotni sotib olgan va uni olgan
 *     bo'lish kerak ("Yetkazildi" statusidagi buyurtma). Bir mahsulotga
 *     bir marta. Ilgari istalgan odam cheksiz sharh yozardi (F-09).
 *
 *  2. Sharh qo'shilgach mahsulotdagi rating va reviews qayta hisoblanadi.
 *     Ilgari ular hech qachon yangilanmasdi va katalogda hamma mahsulot
 *     "5.0 (0)" bo'lib turardi, ichkarida esa boshqa raqam chiqardi.
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

  const productId = String(req.body?.productId ?? '').trim()
  const rating = Math.floor(Number(req.body?.rating))
  const comment = String(req.body?.comment ?? '').trim().slice(0, MAX_COMMENT)

  if (!productId) return fail(res, 400, 'Mahsulot tanlanmagan')
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return fail(res, 400, "Baho 1 dan 5 gacha bo'lishi kerak")
  }

  const db = await adminDb()
  const userId = Number(uid)

  try {
    const result = await db.runTransaction(async (tx) => {
      // ── O'qishlar ──
      const productRef = db.collection('products').doc(productId)
      const productSnap = await tx.get(productRef)
      if (!productSnap.exists) throw new Error('PRODUCT_GONE')

      const userSnap = await tx.get(db.collection('users').doc(uid))

      // Shu mahsulotga ilgari sharh yozganmi?
      const mine = await tx.get(
        db.collection('reviews')
          .where('userId', '==', userId)
          .where('productId', '==', Number(productId))
          .limit(1),
      )
      if (!mine.empty) throw new Error('ALREADY_REVIEWED')

      /*
         Sotib olganini tekshirish — BITTA hujjat o'qish.

         Ilgari bu yerda mijozning BARCHA yetkazilgan buyurtmalari
         o'qilardi. Sodiq mijozda 200 buyurtma bo'lsa, bitta sharh yozish
         uchun 200 hujjat tashilardi (ustiga tranzaksiya chegaralari ham
         bor). Endi xarid yozuvi `users/{uid}/purchased/{taomId}` da
         saqlanadi — uni buyurtma «Yetkazildi» bo'lganda API qo'yadi.
      */
      const purchaseRef = db.collection('users').doc(uid).collection('purchased').doc(productId)
      const purchaseSnap = await tx.get(purchaseRef)
      if (!purchaseSnap.exists) throw new Error('NOT_PURCHASED')

      // ── Yozishlar ──
      const userData = userSnap.data() || {}
      const userName = [userData.first_name, userData.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Foydalanuvchi'

      const reviewRef = db.collection('reviews').doc()
      tx.set(reviewRef, {
        productId: Number(productId),
        userId,
        userName,
        rating,
        comment,
        date: new Date().toISOString(),
      })

      /*
         Reyting yig'indi bilan yangilanadi.

         Ilgari o'rtachani hisoblash uchun mahsulotning BARCHA sharhlari
         o'qilardi — ommabop taomda bu yuzlab hujjat. Endi mahsulotda
         `ratingSum` va `reviews` saqlanadi, yangi baho ularga qo'shiladi.
      */
      const product = productSnap.data() || {}
      const oldCount = Number(product.reviews) || 0
      // `ratingSum` yo'q bo'lsa (eski mahsulotlar) — mavjud o'rtachadan
      // tiklaymiz; `scripts/backfill-rating-sum.mjs` uni aniq to'g'rilaydi
      const oldSum = Number.isFinite(Number(product.ratingSum))
        ? Number(product.ratingSum)
        : Math.round((Number(product.rating) || 0) * oldCount)

      const count = oldCount + 1
      const sum = oldSum + rating
      const average = Math.round((sum / count) * 10) / 10

      tx.update(productRef, { rating: average, ratingSum: sum, reviews: count })

      return { id: reviewRef.id, rating: average, reviews: count }
    })

    return res.status(200).json(result)
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const messages: Record<string, string> = {
      PRODUCT_GONE: 'Mahsulot topilmadi',
      ALREADY_REVIEWED: 'Siz bu mahsulotga allaqachon sharh qoldirgansiz',
      NOT_PURCHASED: 'Sharh qoldirish uchun avval mahsulotni sotib olishingiz kerak',
    }
    if (messages[code]) return fail(res, 403, messages[code])

    console.error('[reviews] xato:', error)
    return fail(res, 500, "Sharh saqlanmadi, qayta urinib ko'ring")
  }
}
