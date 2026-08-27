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
  botUsername: 'afsonarestoran_bot',
  /** Aloqa — admin panelda o'zgartiriladi. */
  phone: '+998 93 647 83 83',
  telegram: 'Sherzod_022',
  email: 'abubakrfrontend@gmail.com',
  address: 'Olmaliq',
} as const

export const BOT_URL = `https://t.me/${BRAND.botUsername}`

/**
 * Logotip rasmi. Vite uni bundle'ga qo'shadi va xeshlangan yo'l beradi —
 * shuning uchun `<img src={LOGO} />` deb ishlatiladi.
 */
export { default as LOGO } from '../images/logo.jpg'
