/**
 * Vercel uchun muhit o'zgaruvchilarini tayyor holda chiqaradi.
 *
 *   node scripts/vercel-env.mjs
 *
 * Chiqqan qiymatlarni Vercel → Settings → Environment Variables ga
 * ko'chiring (Production, Preview, Development — uchalasiga ham).
 *
 * DIQQAT: chiqishda bot tokeni va Firebase kaliti bor. Uni hech kimga
 * yubormang va faylga saqlamang.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const env = {}
for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
  const [key, ...rest] = trimmed.split('=')
  env[key.trim()] = rest.join('=').trim().replace(/^['"]|['"]$/g, '')
}

const account = readFileSync(resolve(ROOT, env.FIREBASE_KEY_FILE), 'utf8')

// Vercel'ga JSON bitta qatorda kerak
const oneLine = JSON.stringify(JSON.parse(account))

const rows = [
  ['BOT_TOKEN', env.BOT_TOKEN],
  ['FIREBASE_SERVICE_ACCOUNT', oneLine],
  ['ADMIN_EMAILS', env.ADMIN_EMAILS],
  ['ADMIN_SETUP_KEY', env.ADMIN_SETUP_KEY],
  ['ADMIN_CHAT_IDS', env.ADMIN_CHAT_IDS],
  ['MINI_APP_URL', env.MINI_APP_URL],
  ['ADMIN_PANEL_URL', env.ADMIN_PANEL_URL],
]

console.log('\n═══ Vercel → Settings → Environment Variables ═══\n')
for (const [key, value] of rows) {
  console.log(`── ${key}`)
  console.log(value || '(bo‘sh)')
  console.log('')
}
console.log('Qo‘shib bo‘lgach — loyihani qayta deploy qiling.\n')
