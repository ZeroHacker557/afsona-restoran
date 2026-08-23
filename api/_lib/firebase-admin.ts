import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Serverless funksiyalar uchun firebase-admin.
 * Service account JSON butunligicha FIREBASE_SERVICE_ACCOUNT env
 * o'zgaruvchisida saqlanadi (Vercel Environment Variables).
 */
function createApp(): App {
  const existing = getApps()
  if (existing.length) return existing[0]

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT sozlanmagan')
  }

  let parsed: Record<string, string>
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT yaroqli JSON emas')
  }

  return initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      // Vercel env'da yangi qatorlar \n ko'rinishida saqlanadi
      privateKey: (parsed.private_key || '').replace(/\n/g, '\n'),
    }),
  })
}

export function adminAuth() {
  return getAuth(createApp())
}

export function adminDb() {
  return getFirestore(createApp())
}
