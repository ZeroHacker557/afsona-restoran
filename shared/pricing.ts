/**
 * Buyurtma summasini hisoblash — bitta manba.
 *
 * Nega alohida fayl: bir xil formula uch joyda kerak — serverda
 * (`api/orders.ts`), savatda va rasmiylashtirish sahifasida. Ular
 * ajralib qolsa, mijoz ekranda bir summani ko'rib, chekda boshqasini
 * oladi. Shuning uchun formula shu yerda turadi va uch joy ham shuni
 * chaqiradi.
 */

/** Hisob uchun yetarli bo'lgan eng kichik ko'rinish. */
export type PricedItem = {
  product: { containerPrice?: number | null }
  quantity: number
}

/**
 * Idishlar uchun jami.
 *
 * Idish narxi porsiyaga bog'liq: 3 ta manti buyurtma qilinsa, 3 ta
 * idish beriladi. Narxi yo'q yoki 0 bo'lgan taom idishsiz ketadi.
 */
export function containerTotal(items: PricedItem[]): number {
  return items.reduce((sum, item) => {
    const price = Number(item.product?.containerPrice)
    const qty = Number(item.quantity)
    if (!Number.isFinite(price) || price <= 0) return sum
    if (!Number.isFinite(qty) || qty <= 0) return sum
    return sum + Math.round(price) * Math.floor(qty)
  }, 0)
}

/**
 * Yakuniy summa.
 *
 * Tartib muhim: chegirma faqat TAOM summasiga tushadi. Idish va
 * yetkazish — restoran uchun haqiqiy xarajat, promokod ularga
 * berilmaydi. Shu sababli ikkalasi chegirmadan keyin qo'shiladi.
 */
export function orderTotal(parts: {
  subtotal: number
  discount?: number
  containerFee?: number
  deliveryFee?: number
}): number {
  const subtotal = Math.max(Number(parts.subtotal) || 0, 0)
  const discount = Math.max(Number(parts.discount) || 0, 0)
  const containerFee = Math.max(Number(parts.containerFee) || 0, 0)
  const deliveryFee = Math.max(Number(parts.deliveryFee) || 0, 0)

  return Math.max(subtotal - discount, 0) + containerFee + deliveryFee
}
