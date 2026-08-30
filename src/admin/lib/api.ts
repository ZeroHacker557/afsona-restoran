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
    // 404 — `/api/admin` umuman yo'q. Deyarli har doim bitta sabab:
    // `vite dev` serverless funksiyalarni ishga tushirmaydi. Buni ochiq
    // aytmasak, "sudrash ishlamayapti" degan noto'g'ri xulosa chiqadi.
    if (response.status === 404) {
      throw new Error(
        import.meta.env.DEV
          ? "API lokal serverda ishlamaydi — `vercel dev` bilan ishga tushiring yoki saytda sinang"
          : 'API topilmadi (404) — deploy tugaganini tekshiring',
      )
    }
    throw new Error(data?.error || `So'rov bajarilmadi (${response.status})`)
  }

  return data as T
}
