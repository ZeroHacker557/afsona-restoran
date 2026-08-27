/**
 * Firestore va Storage qoidalarini Firebase'ga yuklaydi.
 *
 *   node scripts/deploy-rules.mjs
 *
 * Firebase CLI o'rniga — service account bilan Firebase Rules API'ga
 * murojaat qiladi. `firestore.rules` va `storage.rules` fayllari qanday
 * bo'lsa, shundayligicha yuklanadi va darhol amalga kiritiladi.
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
const bucket = env.FIREBASE_STORAGE_BUCKET || `${project}.firebasestorage.app`

const auth = new GoogleAuth({
  credentials: account,
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
})
const client = await auth.getClient()

async function api(method, path, body) {
  const response = await client.request({
    url: `https://firebaserules.googleapis.com/v1/${path}`,
    method,
    data: body,
    validateStatus: () => true,
  })
  return { status: response.status, data: response.data }
}

/** Qoidalar faylini yuklaydi va berilgan "release" ga bog'laydi. */
async function publish(label, file, releaseId) {
  const source = readFileSync(resolve(ROOT, file), 'utf8')

  const created = await api('POST', `projects/${project}/rulesets`, {
    source: { files: [{ name: file, content: source }] },
  })

  if (created.status !== 200) {
    console.error(`❌ ${label}: ruleset yaratilmadi (${created.status})`)
    console.error(JSON.stringify(created.data, null, 2).slice(0, 600))
    return false
  }

  const rulesetName = created.data.name
  const releaseName = `projects/${project}/releases/${releaseId}`

  // Avval mavjud release'ni yangilaymiz; bo'lmasa — yangisini yaratamiz
  let result = await api('PATCH', `${releaseName}`, {
    release: { name: releaseName, rulesetName },
  })

  if (result.status === 404) {
    result = await api('POST', `projects/${project}/releases`, {
      name: releaseName,
      rulesetName,
    })
  }

  if (result.status !== 200) {
    console.error(`❌ ${label}: release yangilanmadi (${result.status})`)
    console.error(JSON.stringify(result.data, null, 2).slice(0, 600))
    return false
  }

  console.log(`✅ ${label} qoidalari yuklandi`)
  return true
}

console.log(`\n🔐 Loyiha: ${project}\n`)

await publish('Firestore', 'firestore.rules', 'cloud.firestore')
await publish('Storage', 'storage.rules', `firebase.storage/${bucket}`)

console.log('')
process.exit(0)
