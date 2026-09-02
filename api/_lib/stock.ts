import type { OrderDoc } from './order-notify.js'

/**
 * Ombor qoldig'i.
 *
 * Buyurtma yaratilganda qoldiq kamayadi (`api/orders.ts`). Buyurtma bekor
 * qilinsa — qaytarilishi shart. Ilgari bu faqat mijoz o'zi bekor qilganda
 * ishlardi; admin paneldan bekor qilinganda qoldiq kamaygan holicha
 * qolib ketardi va taom sekin-asta "tugagan" holatga o'tib, sotuvdan
 * chiqib qolardi.
 *
 * Ikki tomonlama hisob buzilmasligi uchun buyurtmada `stockRestored`
 * bayrog'i saqlanadi: qoldiq bir marta qaytariladi, buyurtma statusdan
 * qaytarilsa — qaytadan kamaytiriladi.
 */

type Tx = FirebaseFirestore.Transaction
type Db = FirebaseFirestore.Firestore

/** Buyurtmadagi taomlar: mahsulot id → umumiy miqdor. */
export function orderQuantities(order: OrderDoc): Map<string, number> {
  const items = Array.isArray(order.products) ? order.products : []
  const totals = new Map<string, number>()

  for (const item of items) {
    const raw = (item?.product as { id?: unknown } | undefined)?.id
    const id = String(raw ?? '').trim()
    if (!id) continue
    const quantity = Number(item?.quantity) || 0
    if (quantity <= 0) continue
    totals.set(id, (totals.get(id) || 0) + quantity)
  }

  return totals
}

/**
 * Tranzaksiya ichida qoldiqni o'zgartiradi.
 *
 * MUHIM: Firestore tranzaksiyasida barcha o'qishlar yozishlardan oldin
 * bo'lishi shart. Shuning uchun bu funksiyani chaqiruvchi tranzaksiyaning
 * yozish qismidan OLDIN chaqirish kerak.
 *
 * @param direction  `+1` — qaytarish (bekor qilindi),
 *                   `-1` — qayta kamaytirish (buyurtma tiklandi)
 */
export async function adjustStock(
  tx: Tx,
  db: Db,
  order: OrderDoc,
  direction: 1 | -1,
): Promise<number> {
  const totals = orderQuantities(order)
  if (!totals.size) return 0

  const ids = [...totals.keys()]
  const refs = ids.map((id) => db.collection('products').doc(id))
  const snaps = await tx.getAll(...refs)

  let changed = 0
  snaps.forEach((snap) => {
    if (!snap.exists) return
    const data = snap.data() as FirebaseFirestore.DocumentData

    // Qoldiq yuritilmaydigan taomlarga tegmaymiz
    if (typeof data.stock !== 'number') return

    const delta = (totals.get(snap.id) || 0) * direction
    // Manfiy qoldiq ma'nosiz — pastki chegara nol
    const next = Math.max(data.stock + delta, 0)
    if (next === data.stock) return

    tx.update(snap.ref, { stock: next })
    changed++
  })

  return changed
}

/** Shu statuslarda buyurtma "bekor qilingan" hisoblanadi. */
export const CANCELLED_STATUSES = new Set(['Bekor qilingan', 'Rad etildi'])
