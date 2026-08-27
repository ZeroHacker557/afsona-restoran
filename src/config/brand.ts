/**
 * Brend ma'lumotlari — bitta joyda.
 *
 * Bu yerdagi qiymatlar ZAXIRA (fallback) hisoblanadi: aloqa ma'lumotlari va
 * restoran nomi admin panelda o'zgartirilsa, ilova Firestore'dagi
 * `settings/brand` hujjatidan o'qiydi. Baza hali to'ldirilmagan bo'lsa yoki
 * internet uzilsa — shu qiymatlar ko'rsatiladi.
 */
export const BRAND = {
  /** Logotipning birinchi qismi (qora/oq rangda). */
  name: 'Afsona',
  /** Logotipning ikkinchi qismi (brend rangida). */
  nameSuffix: 'Restaurant',
  /** To'liq nom — sarlavhalar va xabarlar uchun. */
  fullName: 'Afsona Restaurant',
  /** Telegram bot foydalanuvchi nomi, @ belgisisiz. */
  botUsername: 'afsona_bot',
  /** Aloqa — admin panelda o'zgartiriladi. */
  phone: '+998 00 000 00 00',
  telegram: 'afsona_support',
  email: 'info@afsona.uz',
  address: '',
} as const

export const BOT_URL = `https://t.me/${BRAND.botUsername}`
