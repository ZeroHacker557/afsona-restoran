/**
 * Firestore composite indekslarini yaratadi.
 *
 *   node scripts/deploy-indexes.mjs
 *
 * Firebase CLI o'rniga — service account bilan Firestore Admin API'ga
 * murojaat qiladi (`deploy-rules.mjs` bilan bir xil usul).
 *
 * Indeks nima uchun kerak: Firestore'da bitta maydon bo'yicha filtr va
 * BOSHQA maydon bo'yicha tartiblash birga ishlatilsa (masalan
 * `where('userId','==',...)` + `orderBy('date','desc')`), unga alohida
 * composite indeks kerak. Busiz so'rov ishlamaydi — shuning uchun kod
 * ilgari umuman tartiblamas va butun ro'yxatni yuklab olardi.
 *
 * Indeks qurilishi bir necha daqiqa davom etadi; shu vaqtda so'rov
 * "failed-precondition" qaytarishi mumkin.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleAuth } from 'google-auth-library'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const env = {}
for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
  const [key, ...rest] = trimmed.split('=')
  env[key.trim()] = rest.join('=').trim().replace(/^['"]|['"]$/g, '')
}

const account = JSON.parse(readFileSync(resolve(ROOT, env.FIREBASE_KEY_FILE), 'utf8'))
const project = account.project_id

const auth = new GoogleAuth({
  credentials: account,
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
})
const client = await auth.getClient()

const BASE = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`

async function api(method, url, body) {
  const response = await client.request({ url, method, data: body, validateStatus: () => true })
  return { status: response.status, data: response.data }
}

console.log(`🔐 Loyiha: ${project}\n`)

const config = JSON.parse(readFileSync(resolve(ROOT, 'firestore.indexes.json'), 'utf8'))

for (const index of config.indexes) {
  const group = index.collectionGroup
  const label = `${group}(${index.fields.map((f) => f.fieldPath).join(', ')})`

  const created = await api('POST', `${BASE}/collectionGroups/${group}/indexes`, {
    queryScope: index.queryScope || 'COLLECTION',
    fields: index.fields.map((f) => ({ fieldPath: f.fieldPath, order: f.order })),
  })

  if (created.status === 200) {
    console.log(`✅ ${label} — yaratilmoqda (bir necha daqiqa)`)
  } else if (created.status === 409) {
    console.log(`↩️  ${label} — allaqachon bor`)
  } else {
    console.error(`❌ ${label} — xato (${created.status})`)
    console.error(JSON.stringify(created.data, null, 2).slice(0, 500))
  }
}

// Holatni ko'rsatamiz
console.log('\n📋 Hozirgi indekslar:')
for (const group of [...new Set(config.indexes.map((i) => i.collectionGroup))]) {
  const list = await api('GET', `${BASE}/collectionGroups/${group}/indexes`)
  for (const index of list.data?.indexes || []) {
    const fields = (index.fields || [])
      .filter((f) => f.fieldPath !== '__name__')
      .map((f) => `${f.fieldPath} ${f.order === 'DESCENDING' ? '↓' : '↑'}`)
      .join(', ')
    if (fields) console.log(`   ${group}: ${fields} — ${index.state}`)
  }
}
