/**
 * Storage'dagi rasmlarga kesh sarlavhasini qo'yadi.
 *
 *   node scripts/fix-image-cache.mjs
 *
 * Nima uchun: Firebase Storage sukut bo'yicha
 * `Cache-Control: private, max-age=0` qo'yadi — ya'ni brauzer rasmni
 * umuman saqlamaydi. Mijoz menyuni har ochganda hamma rasm qaytadan
 * yuklanadi va sahifa sekin ochiladi.
 *
 * Yangi yuklanadigan rasmlarga buni `src/admin/lib/upload.ts` o'zi
 * qo'yadi. Bu skript esa ALLAQACHON yuklangan fayllarni to'g'rilaydi —
 * bir marta ishlatilsa yetarli.
 *
 * `immutable` xavfsiz: fayl nomlari takrorlanmaydi (vaqt belgisi +
 * tasodifiy qism), rasm almashtirilsa yangi nom paydo bo'ladi.
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
  storageBucket: env.FIREBASE_STORAGE_BUCKET,
})

const CACHE = 'public, max-age=31536000, immutable'
const bucket = admin.storage().bucket()

let yangilandi = 0
let tegilmadi = 0

for (const prefix of ['products/', 'broadcast/']) {
  const [files] = await bucket.getFiles({ prefix })
  console.log(`\n📁 ${prefix} — ${files.length} ta fayl`)

  for (const file of files) {
    if (file.metadata.cacheControl === CACHE) {
      tegilmadi++
      continue
    }
    // Faqat sarlavha o'zgaradi — fayl mazmuni va havolasi o'sha holicha
    await file.setMetadata({ cacheControl: CACHE })
    console.log(`   ✅ ${file.name.replace(prefix, '')}`)
    yangilandi++
  }
}

console.log(`\n${yangilandi} ta fayl yangilandi, ${tegilmadi} tasi allaqachon to'g'ri edi`)
process.exit(0)
