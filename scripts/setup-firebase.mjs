/**
 * Firebase'ni birinchi marta tayyorlash.
 *
 *   node scripts/setup-firebase.mjs
 *
 * Nima qiladi (hammasi XAVFSIZ — mavjud ma'lumot ustiga yozilmaydi):
 *   1. Admin hisobini yaratadi (Firebase Auth) va `admin: true` claim beradi
 *   2. settings/admins  — panelga kira oladigan emaillar + Telegram ID'lar
 *   3. settings/payment, settings/delivery, settings/hours, settings/brand
 *      hujjatlarini boshlang'ich qiymatlar bilan yaratadi (yo'q bo'lsa)
 *
 * Qiymatlar loyiha ildizidagi `.env` faylidan olinadi.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ── .env ─────────────────────────────────────────────────────
const env = {}
for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
  const [key, ...rest] = trimmed.split('=')
  env[key.trim()] = rest.join('=').trim().replace(/^['"]|['"]$/g, '')
}

const keyFile = resolve(ROOT, env.FIREBASE_KEY_FILE)
const account = JSON.parse(readFileSync(keyFile, 'utf8'))

initializeApp({
  credential: cert({
    projectId: account.project_id,
    clientEmail: account.client_email,
    privateKey: account.private_key.replace(/\\n/g, '\n'),
  }),
})

const db = getFirestore()
db.settings({ preferRest: true })
const auth = getAuth()

const ADMIN_EMAIL = (process.argv[2] || env.ADMIN_EMAILS || '').split(',')[0].trim().toLowerCase()
const ADMIN_PASSWORD = process.argv[3] || process.env.ADMIN_PASSWORD || ''

console.log(`\n📦 Loyiha: ${account.project_id}\n`)

// ── 1. Admin hisobi ──────────────────────────────────────────
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  let uid
  try {
    const user = await auth.getUserByEmail(ADMIN_EMAIL)
    uid = user.uid
    await auth.updateUser(uid, { password: ADMIN_PASSWORD })
    console.log(`✅ Admin hisobi yangilandi: ${ADMIN_EMAIL}`)
  } catch {
    const created = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      emailVerified: true,
    })
    uid = created.uid
    console.log(`✅ Admin hisobi yaratildi: ${ADMIN_EMAIL}`)
  }
  await auth.setCustomUserClaims(uid, { admin: true })
  console.log('✅ admin:true huquqi berildi')
} else {
  console.log('⏭  Admin hisobi o‘tkazib yuborildi (email yoki parol berilmadi)')
}

// ── 2. settings/admins ───────────────────────────────────────
const telegramIds = String(env.ADMIN_CHAT_IDS || '')
  .split(/[,\s;]+/)
  .map(Number)
  .filter((id) => Number.isFinite(id) && id !== 0)

const emails = String(env.ADMIN_EMAILS || '')
  .split(/[,\s;]+/)
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean)

await db.collection('settings').doc('admins').set({ emails, ids: telegramIds }, { merge: true })
console.log(`✅ settings/admins — ${emails.length} email, ${telegramIds.length} Telegram ID`)

// ── 3. Boshlang'ich sozlamalar (faqat yo'q bo'lsa) ──────────
async function ensure(docId, value) {
  const ref = db.collection('settings').doc(docId)
  if ((await ref.get()).exists) {
    console.log(`⏭  settings/${docId} allaqachon bor — tegilmadi`)
    return
  }
  await ref.set(value)
  console.log(`✅ settings/${docId} yaratildi`)
}

await ensure('payment', {
  cardNumber: env.CARD_NUMBER || '5614 6818 1872 7921',
  cardOwner: env.CARD_OWNER || 'Abubakir Abdulbositov',
})

await ensure('delivery', { fee: 0, freeFrom: 0, minOrder: 0 })

await ensure('brand', {
  name: 'Afsona Restaurant',
  phone: '+998 93 647 83 83',
  telegram: 'Sherzod_022',
  email: 'abubakrfrontend@gmail.com',
  address: 'Olmaliq',
})

await ensure('hours', {
  // Boshida o'chirilgan: restoran doim ochiq. Panelda yoqiladi.
  enabled: false,
  temporarilyClosed: false,
  closedNote: '',
  tzOffset: 300,
  days: Array.from({ length: 7 }, () => ({ closed: false, open: '09:00', close: '23:00' })),
})

console.log('\n🎉 Tayyor. Endi /admin sahifasiga kiring.\n')
process.exit(0)
