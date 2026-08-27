import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { app } from '../../lib/firebase'

/**
 * Panelga kirish — Firebase Auth (email + parol).
 *
 * Kirgandan keyin server `admin: true` custom claim qo'yadi va token
 * majburan yangilanadi. Aynan shu claim Firestore/Storage qoidalarida
 * tekshiriladi — ya'ni parolni bilgan, lekin ro'yxatda yo'q odam hech
 * narsani o'zgartira olmaydi.
 */
export const auth = getAuth(app)

/** Sessiya brauzerda saqlanadi — sahifa yangilanganda qaytadan kirish shart emas. */
const persistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('[admin-auth] persistence:', error)
})

export type AdminSession = {
  email: string
}

/** Firebase xatolarini tushunarli o'zbekcha matnga aylantiradi. */
function readableError(error: unknown): string {
  const code = (error as { code?: string })?.code || ''
  const map: Record<string, string> = {
    'auth/invalid-email': "Email noto'g'ri yozilgan",
    'auth/user-disabled': "Bu hisob o'chirib qo'yilgan",
    'auth/user-not-found': 'Bunday admin topilmadi',
    'auth/wrong-password': "Parol noto'g'ri",
    'auth/invalid-credential': "Email yoki parol noto'g'ri",
    'auth/too-many-requests': "Juda ko'p urinish. Biroz kutib, qayta urining",
    'auth/network-request-failed': 'Internet bilan aloqa yo‘q',
    'auth/operation-not-allowed':
      'Firebase Console → Authentication → Sign-in method da "Email/Password" yoqilmagan',
  }
  if (map[code]) return map[code]
  return error instanceof Error ? error.message : 'Kirishda xato'
}

/**
 * Serverdan admin huquqini so'raydi. Claim yangi qo'yilgan bo'lsa
 * tokenni majburan yangilaymiz — aks holda Firestore qoidalari eski
 * (claim'siz) tokenni ko'radi va yozishlar rad etiladi.
 */
export async function claimAdmin(user: User): Promise<AdminSession> {
  const token = await user.getIdToken()

  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'session' }),
  }).catch(() => null)

  const payload = response
    ? ((await response.json().catch(() => null)) as
        | { ok?: boolean; email?: string; refreshed?: boolean; error?: string }
        | null)
    : null

  // Server aniq "yo'q" desa — kiritmaymiz (ro'yxatdan chiqarilgan admin)
  if (response && (response.status === 401 || response.status === 403)) {
    throw new Error(payload?.error || 'Ruxsat yo‘q')
  }

  if (response?.ok && payload?.ok) {
    if (payload.refreshed) await user.getIdToken(true)
    return { email: payload.email || user.email || '' }
  }

  // Serverga yetib bo'lmadi (lokal `npm run dev` da /api ishlamaydi yoki
  // vaqtinchalik uzilish). Tokenda huquq allaqachon bo'lsa — kiritamiz.
  const claims = (await user.getIdTokenResult()).claims
  if (claims.admin === true) {
    console.warn('[admin-auth] /api/admin javob bermadi — mavjud huquq bilan davom etamiz')
    return { email: user.email || '' }
  }

  throw new Error(payload?.error || 'Ruxsat tekshirilmadi')
}

export async function signIn(email: string, password: string): Promise<AdminSession> {
  await persistenceReady
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
    return await claimAdmin(credential.user)
  } catch (error) {
    // Ruxsat yo'q bo'lsa sessiyani ochiq qoldirmaymiz
    if ((error as { code?: string })?.code === undefined) await signOut(auth).catch(() => {})
    throw new Error(readableError(error), { cause: error })
  }
}

export function signOutAdmin() {
  return signOut(auth)
}

export function onAdminAuthChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

/** /api/admin so'rovlari uchun joriy ID token. */
export async function idToken(): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Tizimga kirilmagan')
  return user.getIdToken()
}
