import { useEffect, useRef } from 'react'

/**
 * Gorizontal ro'yxatni (masalan kategoriyalar strip'i) sekin, avtomatik
 * suradi — faqat kontent ekranga sig'masa (ya'ni scroll bo'lsa).
 *
 * - Sekin, uzluksiz harakat (ping-pong: oxiriga yetsa ortga qaytadi).
 * - Foydalanuvchi teksa/hover qilsa yoki qo'lda sursa — to'xtaydi,
 *   biroz vaqtdan keyin qaytadan davom etadi.
 * - Kontent sig'sa (kam kategoriya) — umuman harakatlanmaydi.
 * - `prefers-reduced-motion` yoqilgan bo'lsa — hurmat qiladi, harakat yo'q.
 *
 * MUHIM: strip'da `scroll-snap-type` bor — u dasturiy suvurishni "tortib"
 * to'xtatadi. Shuning uchun avto-scroll paytida snap vaqtincha o'chiriladi
 * va harakat float akkumulyatordan boshqariladi (piksel-osti yaxlitlanishga
 * qarshi).
 *
 * @param speed  Har kadrdagi piksel (60fps). 0.5 ≈ 30px/soniya — sekin.
 */
export function useAutoScroll<T extends HTMLElement = HTMLElement>(speed = 0.5) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const originalSnap = el.style.scrollSnapType
    let raf = 0
    let dir = 1
    let paused = false
    let pos = el.scrollLeft
    let resumeTimer: ReturnType<typeof setTimeout> | undefined

    const canScroll = () => el.scrollWidth - el.clientWidth > 4

    const enableAuto = () => { el.style.scrollSnapType = 'none' }
    const restoreSnap = () => { el.style.scrollSnapType = originalSnap }

    const step = () => {
      if (!paused && canScroll()) {
        const max = el.scrollWidth - el.clientWidth
        pos += speed * dir
        if (pos >= max) { pos = max; dir = -1 }
        else if (pos <= 0) { pos = 0; dir = 1 }
        el.scrollLeft = pos
      }
      raf = requestAnimationFrame(step)
    }

    const pause = () => {
      paused = true
      restoreSnap() // qo'lda surishda snap ishlasin
      if (resumeTimer) clearTimeout(resumeTimer)
    }
    const resumeSoon = () => {
      if (resumeTimer) clearTimeout(resumeTimer)
      resumeTimer = setTimeout(() => {
        pos = el.scrollLeft // foydalanuvchi surgan joydan davom etamiz
        enableAuto()
        paused = false
      }, 1600)
    }

    el.addEventListener('pointerenter', pause)
    el.addEventListener('pointerleave', resumeSoon)
    el.addEventListener('pointerdown', pause)
    el.addEventListener('touchstart', pause, { passive: true })
    el.addEventListener('touchend', resumeSoon, { passive: true })
    el.addEventListener('wheel', () => { pause(); resumeSoon() }, { passive: true })

    enableAuto()
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      if (resumeTimer) clearTimeout(resumeTimer)
      restoreSnap()
      el.removeEventListener('pointerenter', pause)
      el.removeEventListener('pointerleave', resumeSoon)
      el.removeEventListener('pointerdown', pause)
      el.removeEventListener('touchstart', pause)
      el.removeEventListener('touchend', resumeSoon)
    }
  }, [speed])

  return ref
}
