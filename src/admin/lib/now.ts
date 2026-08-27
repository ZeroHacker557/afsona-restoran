import { useEffect, useState } from 'react'

/**
 * Joriy vaqt, daqiqada bir yangilanadi.
 *
 * Render paytida `Date.now()` chaqirish React qoidalariga zid (natija
 * beqaror bo'ladi), shuning uchun vaqt holatda saqlanadi. Yon foyda:
 * "5 daqiqa oldin" yozuvlari o'z-o'zidan yangilanib turadi.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
