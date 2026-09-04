/**
 * Buyurtmani olish usuli — yetkazib berish yoki mijoz o'zi olib ketishi.
 *
 * Nega alohida fayl: statusning ko'rinadigan nomi uchta joyda kerak —
 * mijoz ilovasida, boshqaruv panelida va Telegram xabarlarida. Ular
 * ajralib qolsa, mijoz ilovada «Tayyor» ni, Telegramda «Yetkazilmoqda»
 * ni ko'rib chalkashadi.
 *
 * MUHIM: bazadagi status qiymatlari O'ZGARMAYDI. Olib ketishda faqat
 * ko'rsatiladigan matn boshqacha bo'ladi. Shu sababli kanban ustunlari,
 * statistika, ombor va bekor qilish mantiqi avvalgidek ishlayveradi.
 */

export type DeliveryType = 'delivery' | 'pickup'

/** Noma'lum qiymat — yetkazish. Eski buyurtmalarda maydon umuman yo'q. */
export function readDeliveryType(value: unknown): DeliveryType {
  return value === 'pickup' ? 'pickup' : 'delivery'
}

/** Buyurtma olib ketishga berilganmi. */
export function isPickup(order: { deliveryType?: unknown } | null | undefined): boolean {
  return readDeliveryType(order?.deliveryType) === 'pickup'
}

/**
 * Olib ketishda boshqacha nomlanadigan statuslar.
 *
 * «Yetkazilmoqda» — olib ketishda taom tayyor bo'lgani va mijoz kelishi
 * mumkinligini bildiradi. «Yetkazildi» — mijoz olib ketgani.
 */
const PICKUP_LABEL: Record<string, string> = {
  'Qabul qilindi': 'Tayyorlanmoqda',
  Yetkazilmoqda: 'Tayyor',
  Yetkazildi: 'Topshirildi',
}

/** Statusning mijozga va adminga ko'rinadigan nomi. */
export function statusLabel(status: string, type: DeliveryType): string {
  if (type !== 'pickup') return status
  return PICKUP_LABEL[status] || status
}
