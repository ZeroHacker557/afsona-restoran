/**
 * Promokod qoidalari — bitta joyda.
 *
 * Ilgari bu tekshiruvlar ikki faylda (`api/promo.ts` va `api/orders.ts`)
 * so'zma-so'z takrorlangan edi. Biri o'zgarsa ikkinchisi eskirar va
 * "ko'rsatilgan chegirma boshqa, hisoblangani boshqa" degan holat
 * yuzaga kelardi.
 *
 * Bu modul faqat QOIDANI biladi — o'qishni chaqiruvchi bajaradi
 * (biri tranzaksiya ichida, biri oddiy so'rov bilan).
 */

/** Foydalanish yozuvlari shu ostki kolleksiyada saqlanadi. */
export const USES = 'uses'

export type PromoDoc = Record<string, unknown>

export type PromoContext = {
  /** Chegirmasiz summa. */
  subtotal: number
  /** Shu foydalanuvchi bu koddan avval foydalanganmi. */
  alreadyUsed: boolean
  /** Bu uning birinchi buyurtmasimi (faqat `firstOrderOnly` uchun kerak). */
  isFirstOrder: boolean
}

export type PromoResult =
  | { ok: true; code: string; discountPercent: number }
  | { ok: false; error: string }

/**
 * Promokod shu buyurtmaga yaraydimi.
 * @returns `error` — xato KODI (`PROMO_EXPIRED` kabi), matn emas.
 */
export function checkPromo(data: PromoDoc, ctx: PromoContext): PromoResult {
  if (data.active === false) return { ok: false, error: 'PROMO_INACTIVE' }

  const expiresAt = data.expiresAt ? Date.parse(String(data.expiresAt)) : NaN
  if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) {
    return { ok: false, error: 'PROMO_EXPIRED' }
  }

  const maxUses = Number(data.maxUses)
  const usageCount = Number(data.usageCount) || 0
  if (Number.isFinite(maxUses) && maxUses > 0 && usageCount >= maxUses) {
    return { ok: false, error: 'PROMO_USED_UP' }
  }

  if (ctx.alreadyUsed) return { ok: false, error: 'PROMO_ALREADY_USED' }

  const minOrderTotal = Number(data.minOrderTotal) || 0
  if (ctx.subtotal < minOrderTotal) return { ok: false, error: 'PROMO_MIN_TOTAL' }

  if (data.firstOrderOnly === true && !ctx.isFirstOrder) {
    return { ok: false, error: 'PROMO_FIRST_ONLY' }
  }

  const discountPercent = Math.min(Math.max(Number(data.discountPercent) || 0, 0), 100)
  return { ok: true, code: String(data.code || ''), discountPercent }
}

/**
 * Eski formatdagi `usedBy` massivini ham hisobga oladi.
 *
 * Foydalanish yozuvlari endi `promocodes/{id}/uses/{userId}` hujjatlarida
 * saqlanadi — massiv cheksiz o'sib, Firestore'ning 1 MB hujjat chegarasiga
 * urilardi va har buyurtmada butunlay qayta yozilardi.
 *
 * Lekin allaqachon ishlatilgan promokodlarda eski massiv qolgan. Uni ham
 * tekshirmasak, o'sha mijozlar koddan ikkinchi marta foydalana olardi.
 */
export function usedInLegacyArray(data: PromoDoc, userId: number, uid: string): boolean {
  const usedBy: unknown[] = Array.isArray(data.usedBy) ? data.usedBy : []
  return usedBy.includes(userId) || usedBy.includes(uid)
}

/** Xato kodi → mijozga ko'rinadigan matn. */
export const PROMO_MESSAGES: Record<string, string> = {
  PROMO_NOT_FOUND: 'Bunday promokod topilmadi',
  PROMO_INACTIVE: 'Promokod faol emas',
  PROMO_EXPIRED: 'Promokod muddati tugagan',
  PROMO_USED_UP: 'Promokoddan foydalanish chegarasi tugagan',
  PROMO_ALREADY_USED: 'Siz bu promokoddan allaqachon foydalangansiz',
  PROMO_MIN_TOTAL: 'Bu promokod uchun buyurtma summasi yetarli emas',
  PROMO_FIRST_ONLY: 'Bu promokod faqat birinchi buyurtma uchun',
}
