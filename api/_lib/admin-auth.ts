import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth, adminDb } from './firebase-admin.js'

/**
 * Admin panel (/admin) uchun autentifikatsiya.
 *
 * Admin Firebase Auth'ga email+parol bilan kiradi. Panelga kirish huquqi
 * `admin: true` custom claim bilan belgilanadi — Firestore va Storage
 * qoidalari ham aynan shu claim'ni tekshiradi.
 *
 * Claim'ni faqat server qo'yadi: /api/admin/session foydalanuvchi emailini
 * ruxsat ro'yxati bilan solishtiradi. Ro'yxat — Firestore'dagi
 * `settings/admins` hujjatining `emails` maydoni, ustiga env'dagi
 * ADMIN_EMAILS qo'shiladi (birinchi admin uchun).
 */

export type AdminToken = {
  uid: string
  email: string
}

/** `settings/admins` hujjati — panel emaillari va Telegram xabarnoma ID'lari. */
export const ADMINS_DOC = { collection: 'settings', doc: 'admins' } as const

export function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

/** Env'dagi zaxira ro'yxat: "a@b.com, c@d.com". */
export function envAdminEmails(): string[] {
  return String(process.env.ADMIN_EMAILS || '')
    .split(/[,\s;]+/)
    .map(normalizeEmail)
    .filter(Boolean)
}

/** Ruxsat berilgan emaillar: baza + env. */
export async function allowedAdminEmails(): Promise<Set<string>> {
  const emails = new Set<string>(envAdminEmails())
  try {
    const snap = await (await adminDb()).collection(ADMINS_DOC.collection).doc(ADMINS_DOC.doc).get()
    const stored = snap.exists ? snap.data()?.emails : null
    if (Array.isArray(stored)) {
      for (const item of stored) {
        const email = normalizeEmail(item)
        if (email) emails.add(email)
      }
    }
  } catch (error) {
    console.error('[admin-auth] ro\u2018yxatni o\u2018qib bo\u2018lmadi:', error)
  }
  return emails
}

/**
 * So'rov bot dasturidan kelganmi?
 *
 * Bot Firebase Auth'dan o'tolmaydi (u brauzer emas), shuning uchun
 * BOT_API_SECRET maxfiy kaliti bilan tanitiladi. Kalit faqat serverda
 * va bot mashinasida bo'ladi.
 */
export function isBotRequest(req: VercelRequest): boolean {
  const secret = process.env.BOT_API_SECRET
  if (!secret) return false
  const header = req.headers['x-bot-secret']
  const value = Array.isArray(header) ? header[0] : header
  return typeof value === 'string' && value === secret
}

function bearer(req: VercelRequest): string {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

/**
 * So'rovni yuborgan odam admin ekanini tekshiradi.
 * Admin bo'lmasa javob yozib, `null` qaytaradi — handler shu yerda to'xtaydi.
 */
export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AdminToken | null> {
  const token = bearer(req)
  if (!token) {
    res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' })
    return null
  }

  let decoded
  try {
    decoded = await (await adminAuth()).verifyIdToken(token, true)
  } catch {
    res.status(401).json({ error: 'Sessiya eskirgan, qaytadan kiring' })
    return null
  }

  const email = normalizeEmail(decoded.email)

  // Claim ishonchli manba, lekin ro'yxatdan o'chirilgan admin eski token
  // bilan kirmasligi uchun ro'yxat ham tekshiriladi.
  if (decoded.admin !== true || !(await allowedAdminEmails()).has(email)) {
    res.status(403).json({ error: 'Ruxsat yo\u2018q' })
    return null
  }

  return { uid: decoded.uid, email }
}
