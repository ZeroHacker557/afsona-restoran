import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth, adminDb } from './_lib/firebase-admin.js'
import { fail, requirePost } from './_lib/http.js'
import { checkPromo, PROMO_MESSAGES, usedInLegacyArray, USES } from './_lib/promo.js'

/**
 * POST /api/promo   { code: string, subtotal: number }
 * Authorization: Bearer <Firebase ID token>
 * → { code, discountPercent, discount, total }
 *
 * Faqat OLDINDAN KO'RSATISH uchun. Haqiqiy chegirma buyurtma
 * yaratilayotganda /api/orders ichida qaytadan tekshiriladi —
 * bu javobga ishonib qolinmaydi (F-18).
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

  const code = String(req.body?.code || '').trim().toUpperCase().slice(0, 40)
  const subtotal = Math.max(Math.floor(Number(req.body?.subtotal) || 0), 0)
  if (!code) return fail(res, 400, 'Promokod kiritilmagan')

  try {
    const db = await adminDb()
    const snap = await db
      .collection('promocodes')
      .where('code', '==', code)
      .limit(1)
      .get()

    if (snap.empty) return fail(res, 404, 'Bunday promokod topilmadi')

    const promoRef = snap.docs[0].ref
    const promo = snap.docs[0].data()
    const userId = Number(uid)

    // Foydalanish yozuvi — alohida hujjat; eski massiv ham tekshiriladi
    const useSnap = await promoRef.collection(USES).doc(String(userId)).get()
    const alreadyUsed = useSnap.exists || usedInLegacyArray(promo, userId, uid)

    /*
       "Faqat birinchi buyurtma" shartini bu yerda ham tekshiramiz, aks
       holda mijoz oldindan ko'rishda chegirmani ko'rar, buyurtma
       berayotganda esa rad javob olardi.

       So'rov `api/orders.ts` dagi bilan AYNAN bir xil — ikkalasi bir xil
       javob berishi shart. (Bekor qilingan buyurtmalarni chiqarib
       tashlash `status` bo'yicha qo'shimcha shart talab qiladi, u esa
       Firestore'da composite indeks so'raydi — bu alohida ish.)
    */
    let isFirstOrder = true
    if (promo.firstOrderOnly === true) {
      const previous = await db.collection('orders').where('userId', '==', userId).limit(1).get()
      isFirstOrder = previous.empty
    }

    // Qoidalar `_lib/promo.ts` da — /api/orders bilan bir xil
    const verdict = checkPromo(promo, { subtotal, alreadyUsed, isFirstOrder })
    if (!verdict.ok) {
      return fail(res, 400, PROMO_MESSAGES[verdict.error] || 'Promokod ishlatib bo‘lmaydi')
    }

    const discount = Math.round((subtotal * verdict.discountPercent) / 100)

    return res.status(200).json({
      code: verdict.code || code,
      discountPercent: verdict.discountPercent,
      discount,
      total: Math.max(subtotal - discount, 0),
    })
  } catch (error) {
    console.error('[promo] xato:', error)
    return fail(res, 500, "Promokodni tekshirib bo'lmadi")
  }
}
