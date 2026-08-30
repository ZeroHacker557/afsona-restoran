/**
 * Panelni ilova sifatida o'rnatish (PWA).
 *
 * Brauzer o'rnatish taklifini faqat bir marta, sahifa yuklanganda
 * beradi — va uni o'sha zahoti to'xtatib qolmasak, yo'qoladi. Shuning
 * uchun taklifni shu yerda ushlab turamiz va Sozlamalar sahifasidagi
 * tugma bosilganda ishlatamiz.
 */

/** Chrome'ning standart bo'lmagan hodisasi — TypeScript'da turi yo'q. */
type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let saved: InstallPrompt | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

/** Panel allaqachon ilova sifatida ochilganmi. */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari o'zining eski bayrog'ini ishlatadi
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** Taklif tayyor turibdimi (ya'ni tugmani ko'rsatsa bo'ladimi). */
export function canInstall(): boolean {
  return saved !== null
}

/** Holat o'zgarganda xabar berish — React komponenti shunga obuna bo'ladi. */
export function onInstallStateChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * O'rnatish oynasini ochadi.
 * @returns true — foydalanuvchi rozi bo'ldi.
 */
export async function promptInstall(): Promise<boolean> {
  if (!saved) return false
  await saved.prompt()
  const { outcome } = await saved.userChoice
  // Taklifni qayta ishlatib bo'lmaydi
  saved = null
  notify()
  return outcome === 'accepted'
}

/** Sahifa yuklanganda bir marta chaqiriladi. */
export function initInstall() {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (event) => {
    // Brauzerning o'z chaqiruvini to'xtatamiz — o'zimiz kerakli joyda beramiz
    event.preventDefault()
    saved = event as InstallPrompt
    notify()
  })

  window.addEventListener('appinstalled', () => {
    saved = null
    notify()
  })

  // Service worker — o'rnatish va oflayn sahifa uchun.
  // Dev serverda ro'yxatdan o'tkazmaymiz: HMR bilan chalkashib ketadi.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw-admin.js').catch((error) => {
        console.warn('[admin] service worker ro‘yxatdan o‘tmadi:', error)
      })
    })
  }
}
