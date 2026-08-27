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
