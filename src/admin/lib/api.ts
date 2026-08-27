import { idToken } from './auth'

/** /api/admin ga so'rov — barcha amallar `action` bo'yicha ajratiladi. */
export async function adminPost<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const token = await idToken()

  let response: Response
  try {
    response = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
    })
  } catch {
    throw new Error("Internetga ulanib bo'lmadi")
  }

  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null

  if (!response.ok) {
    throw new Error(data?.error || `So'rov bajarilmadi (${response.status})`)
  }

  return data as T
}
