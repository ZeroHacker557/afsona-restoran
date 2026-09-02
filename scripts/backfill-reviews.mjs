/**
 * Sharh tizimi uchun mavjud ma'lumotni to'ldiradi.
 *
 *   node scripts/backfill-reviews.mjs
 *
 * Ikki ish qiladi:
 *
 *  1. `users/{id}/purchased/{taomId}` — yetkazilgan buyurtmalardan.
 *     Yangi buyurtmalarda buni `api/admin.ts` o'zi qo'yadi, lekin shu
 *     o'zgarishdan oldin yetkazilganlarida yo'q — u mijozlar sharh
 *     qoldira olmay qolardi.
 *
 *  2. `products/{id}.ratingSum` — mavjud sharhlardan aniq yig'indi.
 *     Reyting endi yig'indi orqali yangilanadi (butun sharhlarni qayta
 *     o'qimasdan), shuning uchun boshlang'ich qiymat to'g'ri bo'lishi
 *     kerak.
 *
 * Xavfsiz va takroriy: bir necha marta ishlatilsa ham natija bir xil.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import admin from 'firebase-admin'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const env = {}
for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
  const [key, ...rest] = trimmed.split('=')
  env[key.trim()] = rest.join('=').trim().replace(/^['"]|['"]$/g, '')
}

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(readFileSync(resolve(ROOT, env.FIREBASE_KEY_FILE), 'utf8')),
  ),
})

const db = admin.firestore()

// ── 1. Xaridlar ─────────────────────────────────────────────
console.log('📖 Yetkazilgan buyurtmalar...')
const orders = await db.collection('orders').where('status', '==', 'Yetkazildi').get()

/** userId → Set(productId) */
const xaridlar = new Map()
orders.forEach((doc) => {
  const data = doc.data() || {}
  const userId = Number(data.userId)
  if (!Number.isFinite(userId) || userId === 0) return

  const items = Array.isArray(data.products) ? data.products : []
  for (const item of items) {
    const productId = String(item?.product?.id ?? '').trim()
    if (!productId) continue
    if (!xaridlar.has(userId)) xaridlar.set(userId, new Set())
    xaridlar.get(userId).add(productId)
  }
})

let yozildi = 0
for (const [userId, taomlar] of xaridlar) {
  const userRef = db.collection('users').doc(String(userId))
  const batch = db.batch()
  for (const productId of taomlar) {
    batch.set(
      userRef.collection('purchased').doc(productId),
      { productId, at: new Date().toISOString() },
      { merge: true },
    )
    yozildi++
  }
  await batch.commit()
}
console.log(`   ${orders.size} ta buyurtma → ${xaridlar.size} ta mijoz, ${yozildi} ta xarid yozuvi`)

// ── 2. Reyting yig'indisi ───────────────────────────────────
console.log('\n📖 Sharhlar...')
const reviews = await db.collection('reviews').get()

/** productId → { sum, count } */
const reytinglar = new Map()
reviews.forEach((doc) => {
  const data = doc.data() || {}
  const productId = String(data.productId ?? '').trim()
  const rating = Number(data.rating)
  if (!productId || !Number.isFinite(rating)) return

  const entry = reytinglar.get(productId) || { sum: 0, count: 0 }
  entry.sum += rating
  entry.count += 1
  reytinglar.set(productId, entry)
})

const products = await db.collection('products').get()
let yangilandi = 0

for (const doc of products.docs) {
  const { sum = 0, count = 0 } = reytinglar.get(doc.id) || {}
  const data = doc.data() || {}

  // Sharhi yo'q taomga tegmaymiz — sukut bo'yicha 5.0 ko'rinadi
  if (count === 0 && data.ratingSum === undefined) continue

  const average = count ? Math.round((sum / count) * 10) / 10 : Number(data.rating) || 5
  if (data.ratingSum === sum && data.reviews === count) continue

  await doc.ref.set({ ratingSum: sum, reviews: count, rating: average }, { merge: true })
  yangilandi++
}

console.log(`   ${reviews.size} ta sharh → ${yangilandi} ta taom yangilandi`)
console.log('\n✅ Tayyor')
process.exit(0)
