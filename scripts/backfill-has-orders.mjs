/**
 * Mavjud mijozlarga `hasOrders` bayrog'ini qo'yadi.
 *
 *   node scripts/backfill-has-orders.mjs
 *
 * Bir martalik ish. Yangi buyurtmalarda bayroqni `api/orders.ts` o'zi
 * qo'yadi, lekin shu o'zgarishdan OLDIN buyurtma bergan mijozlarda u
 * yo'q — ular xabarnomadagi «xarid qilganlar» segmentiga tushmay
 * qolardi.
 *
 * Xavfsiz: faqat `hasOrders` maydonini qo'shadi, boshqa hech narsaga
 * tegmaydi. Bir necha marta ishlatilsa ham natija bir xil.
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

console.log('📖 Buyurtmalar o‘qilmoqda...')
const orders = await db.collection('orders').select('userId').get()

const buyers = new Set()
orders.forEach((doc) => {
  const id = Number(doc.data()?.userId)
  if (Number.isFinite(id) && id !== 0) buyers.add(id)
})
console.log(`   ${orders.size} ta buyurtma → ${buyers.size} ta xaridor`)

console.log('📖 Mijozlar o‘qilmoqda...')
const users = await db.collection('users').select('id', 'hasOrders').get()

let yangilandi = 0
let allaqachon = 0
let batch = db.batch()
let batchSize = 0

for (const doc of users.docs) {
  const data = doc.data() || {}
  const id = Number(data.id ?? doc.id)
  const kerak = buyers.has(id)

  if (data.hasOrders === kerak) {
    allaqachon++
    continue
  }

  batch.set(doc.ref, { hasOrders: kerak }, { merge: true })
  yangilandi++
  batchSize++

  if (batchSize >= 400) {
    await batch.commit()
    batch = db.batch()
    batchSize = 0
  }
}

if (batchSize > 0) await batch.commit()

console.log(`\n✅ ${users.size} ta mijoz tekshirildi`)
console.log(`   ${yangilandi} ta yangilandi, ${allaqachon} ta allaqachon to‘g‘ri edi`)
process.exit(0)
