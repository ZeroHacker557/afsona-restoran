/** Buyurtma statusi → rang. Bir nechta sahifa shu jadvaldan foydalanadi. */
export const STATUS_STYLE: Record<string, { color: string; background: string }> = {
  Yangi: { color: 'var(--brand)', background: 'var(--brand-soft)' },
  'Qabul qilindi': { color: 'var(--info)', background: 'var(--info-soft)' },
  Yetkazilmoqda: { color: 'var(--warning)', background: 'var(--warning-soft)' },
  Yetkazildi: { color: 'var(--success)', background: 'var(--success-soft)' },
  'Bekor qilingan': { color: 'var(--danger)', background: 'var(--danger-soft)' },
  'Rad etildi': { color: 'var(--danger)', background: 'var(--danger-soft)' },
}

/** Buyurtma oqimi — Kanban ustunlari shu tartibda. */
export const ORDER_FLOW = ['Yangi', 'Qabul qilindi', 'Yetkazilmoqda', 'Yetkazildi'] as const

export const ALL_STATUSES = [...ORDER_FLOW, 'Bekor qilingan', 'Rad etildi'] as const

/** Bekor qilingan buyurtmalar tushumga kirmaydi. */
export const DEAD_STATUSES = new Set(['Bekor qilingan', 'Rad etildi'])

/**
 * Bekor qilish sabablari.
 *
 * Nega tayyor ro'yxat: admin shoshib turganda erkin matn yozmaydi —
 * natijada oy oxirida «nega yo'qotdik» degan savolga javob qolmaydi.
 * Tanlangan matn mijozga ham, hisobotga ham o'sha holicha tushadi.
 */
export const CANCEL_REASONS = [
  'Mijoz javob bermadi',
  'Taom tugagan',
  'Manzil noto‘g‘ri yoki topilmadi',
  'Mijoz voz kechdi',
  'Yetkazish hududidan tashqarida',
  'Ish vaqti tugagan',
  'To‘lov amalga oshmadi',
] as const

/** Sabab talab qiladigan statuslar. */
export const CANCEL_STATUSES = new Set(['Bekor qilingan', 'Rad etildi'])
