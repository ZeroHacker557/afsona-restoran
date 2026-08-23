import { getIdToken } from './auth'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Serverdagi funksiyaga so'rov. Har safar yangi ID token olinadi —
 * Firebase uni avtomatik yangilab beradi.
 */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getIdToken()
  if (!token) {
    throw new ApiError("Tizimga kirilmagan. Ilovani Telegram orqali qayta oching.", 401)
  }

  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError("Internetga ulanib bo'lmadi. Aloqani tekshiring.", 0)
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      (payload && typeof payload.error === 'string' && payload.error) ||
      "So'rov bajarilmadi, qayta urinib ko'ring"
    throw new ApiError(message, response.status)
  }

  return payload as T
}
