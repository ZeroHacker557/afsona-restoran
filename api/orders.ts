import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth, adminDb } from './_lib/firebase-admin.js'
import { fail, requirePost } from './_lib/http.js'

const ORDER_NUMBER_START = 1000

type IncomingItem = {
  productId: number | string
  quantity: number
  size?: string
  color?: string
}

type IncomingOrder = {
  items: IncomingItem[]
  customer: {
    name: string
    phone: string
    address: string
    location: { lat: number; lng: number } | null
    comment: string
    paymentMethod: 'Naqd' | 'Karta'
  }
  promoCode?: string
}

/** Mijoz yuborgan ma'lumotni tozalaymiz — narx, jami va status bu yerdan kelmaydi. */
function readOrder(body: unknown): IncomingOrder {
  const b = body as Partial<IncomingOrder> | undefined
  const items = Array.isArray(b?.items) ? b.items : []
  if (items.length === 0) throw new Error("Savat bo'sh")
  if (items.length > 50) throw new Error("Savatda juda ko'p mahsulot")

  const customer = b?.customer
  if (!customer) throw new Error("Mijoz ma'lumoti yo'q")

  const name = String(customer.name || '').trim()
  const phone = String(customer.phone || '').trim()
  const address = String(customer.address || '').trim()
  if (!name || !phone || !address) throw new Error("Ism, telefon va manzil to'ldirilishi shart")

  const paymentMethod = customer.paymentMethod === 'Karta' ? 'Karta' : 'Naqd'

  return {
    items: items.map((item) => {
      const quantity = Math.floor(Number(item.quantity))
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
        throw new Error("Mahsulot miqdori noto'g'ri")
      }
      return {
        productId: item.productId,
        quantity,
        size: item.size ? String(item.size).slice(0, 40) : undefined,
        color: item.color ? String(item.color).slice(0, 40) : undefined,
      }
    }),
    customer: {
      name: name.slice(0, 120),
      phone: phone.slice(0, 40),
      address: address.slice(0, 300),
      location:
        customer.location && typeof customer.location.lat === 'number'
          ? { lat: customer.location.lat, lng: customer.location.lng }
          : null,
      comment: String(customer.comment || '').slice(0, 500),
      paymentMethod,
    },
    promoCode: b?.promoCode ? String(b.promoCode).trim().toUpperCase().slice(0, 40) : undefined,
  }
}

/**
 * POST /api/orders
 * Authorization: Bearer <Firebase ID token>
 *
 * Buyurtmani SERVER yaratadi. Mijoz faqat qaysi mahsulotdan nechta
 * olishini aytadi — narx, chegirma va jami Firestore'dagi haqiqiy
 * qiymatlardan qayta hisoblanadi (F-04, F-18).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return

  // ── Kim so'rayapti ─────────────────────────────────────────
  const authHeader = String(req.headers.authorization || '')
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!idToken) return fail(res, 401, 'Avtorizatsiya talab qilinadi')

  let uid: string
  try {
    const decoded = await adminAuth().verifyIdToken(idToken)
    uid = decoded.uid
  } catch {
    return fail(res, 401, 'Sessiya eskirgan, ilovani qayta oching')
  }

  let order: IncomingOrder
  try {
    order = readOrder(req.body)
  } catch (error) {
    return fail(res, 400, error instanceof Error ? error.message : "Ma'lumot noto'g'ri")
  }

  const db = adminDb()
  const userId = Number(uid)

  try {
    const result = await db.runTransaction(async (tx) => {
      // ── 1. O'qishlar (transaction'da hamma o'qish yozishdan oldin) ──
      const productRefs = order.items.map((item) =>
        db.collection('products').doc(String(item.productId)),
      )
      const productSnaps = await tx.getAll(...productRefs)

      const counterRef = db.collection('counters').doc('orders')
      const counterSnap = await tx.get(counterRef)

      const userRef = db.collection('users').doc(uid)
      const userSnap = await tx.get(userRef)

      let promoRef: FirebaseFirestore.DocumentReference | null = null
      let promoData: FirebaseFirestore.DocumentData | null = null
      if (order.promoCode) {
        const promoQuery = await tx.get(
          db.collection('promocodes').where('code', '==', order.promoCode).limit(1),
        )
        if (promoQuery.empty) throw new Error('PROMO_NOT_FOUND')
        promoRef = promoQuery.docs[0].ref
        promoData = promoQuery.docs[0].data()
      }

      // ── 2. Narxni qayta hisoblash ──────────────────────────
      const products = order.items.map((item, i) => {
        const snap = productSnaps[i]
        if (!snap.exists) throw new Error('PRODUCT_GONE')
        const data = snap.data() as FirebaseFirestore.DocumentData

        const price = Number(data.price)
        if (!Number.isFinite(price) || price <= 0) throw new Error('PRODUCT_PRICE')

        return {
          product: {
            id: Number(data.id ?? snap.id),
            name: String(data.name || ''),
            price,
            images: Array.isArray(data.images) ? data.images : [],
            category: String(data.category || ''),
          },
          quantity: item.quantity,
          size: item.size ?? null,
          color: item.color ?? null,
        }
      })

      const subtotal = products.reduce((sum, p) => sum + p.product.price * p.quantity, 0)

      // ── 3. Promokod ────────────────────────────────────────
      let discountPercent = 0
      let appliedPromo: string | null = null

      if (promoData && promoRef) {
        if (promoData.active === false) throw new Error('PROMO_INACTIVE')

        const expiresAt = promoData.expiresAt ? Date.parse(String(promoData.expiresAt)) : NaN
        if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) throw new Error('PROMO_EXPIRED')

        const maxUses = Number(promoData.maxUses)
        const usageCount = Number(promoData.usageCount) || 0
        if (Number.isFinite(maxUses) && maxUses > 0 && usageCount >= maxUses) {
          throw new Error('PROMO_USED_UP')
        }

        const usedBy: unknown[] = Array.isArray(promoData.usedBy) ? promoData.usedBy : []
        if (usedBy.includes(userId) || usedBy.includes(uid)) throw new Error('PROMO_ALREADY_USED')

        const minOrderTotal = Number(promoData.minOrderTotal) || 0
        if (subtotal < minOrderTotal) throw new Error('PROMO_MIN_TOTAL')

        discountPercent = Math.min(Math.max(Number(promoData.discountPercent) || 0, 0), 100)
        appliedPromo = String(promoData.code || order.promoCode)
      }

      const discount = Math.round((subtotal * discountPercent) / 100)
      const total = Math.max(subtotal - discount, 0)

      // ── 4. Yozishlar ───────────────────────────────────────
      const currentCounter = counterSnap.exists
        ? Number(counterSnap.data()?.value) || ORDER_NUMBER_START
        : ORDER_NUMBER_START
      const nextCounter = currentCounter + 1
      tx.set(counterRef, { value: nextCounter }, { merge: true })

      if (promoRef) {
        const usedBy = Array.isArray(promoData?.usedBy) ? promoData.usedBy : []
        tx.update(promoRef, {
          usageCount: (Number(promoData?.usageCount) || 0) + 1,
          usedBy: [...usedBy, userId],
        })
      }

      const userData = userSnap.data() || {}
      const orderRef = db.collection('orders').doc()

      tx.set(orderRef, {
        orderNumber: `#${nextCounter}`,
        createdAt: new Date().toISOString(),
        products,
        subtotal,
        discount,
        discountPercent,
        promoCode: appliedPromo,
        total,
        status: 'Yangi',
        paymentMethod: order.customer.paymentMethod,
        paymentStatus: order.customer.paymentMethod === 'Karta' ? 'Kutilmoqda' : null,
        customer: { ...order.customer, promoCode: appliedPromo },
        userId,
        username: userData.username ?? null,
        notified: false,
      })

      return { id: orderRef.id, orderNumber: `#${nextCounter}`, total, discount }
    })

    return res.status(200).json(result)
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const messages: Record<string, string> = {
      PRODUCT_GONE: 'Savatdagi mahsulotlardan biri endi mavjud emas',
      PRODUCT_PRICE: "Mahsulot narxi noto'g'ri, adminga murojaat qiling",
      PROMO_NOT_FOUND: 'Bunday promokod topilmadi',
      PROMO_INACTIVE: 'Promokod faol emas',
      PROMO_EXPIRED: 'Promokod muddati tugagan',
      PROMO_USED_UP: 'Promokoddan foydalanish chegarasi tugagan',
      PROMO_ALREADY_USED: 'Siz bu promokoddan allaqachon foydalangansiz',
      PROMO_MIN_TOTAL: 'Bu promokod uchun buyurtma summasi yetarli emas',
    }
    if (messages[code]) return fail(res, 400, messages[code])

    console.error('[orders] xato:', error)
    return fail(res, 500, "Buyurtma yaratilmadi, qayta urinib ko'ring")
  }
}
