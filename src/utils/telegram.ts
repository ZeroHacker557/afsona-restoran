// Telegram WebApp SDK utilities
// https://core.telegram.org/bots/webapps

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

export type TelegramUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

type SafeAreaInset = { top: number; bottom: number; left: number; right: number }

interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    query_id?: string
  }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  safeAreaInset?: SafeAreaInset
  contentSafeAreaInset?: SafeAreaInset
  MainButton: {
    text: string
    isVisible: boolean
    isActive: boolean
    setText: (text: string) => void
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
    enable: () => void
    disable: () => void
    showProgress: (leaveActive?: boolean) => void
    hideProgress: () => void
  }
  BackButton: {
    isVisible: boolean
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  ready: () => void
  expand: () => void
  close: () => void
  sendData: (data: string) => void
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void
  openTelegramLink: (url: string) => void
  showAlert: (message: string, callback?: () => void) => void
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  setBottomBarColor?: (color: string) => void
  enableClosingConfirmation?: () => void
  disableVerticalSwipes?: () => void
  onEvent?: (event: string, handler: () => void) => void
  offEvent?: (event: string, handler: () => void) => void
}

// ── Asosiy kirish nuqtalari ──────────────────────────────────

export function getTelegram(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null
}

/** initData mavjudmi — autentifikatsiya uchun qat'iy tekshiruv. */
export function isTelegram(): boolean {
  return !!window.Telegram?.WebApp?.initData
}

/**
 * Telegram ichida ochilganmi — KENG tekshiruv.
 *
 * `initData` ba'zi mijozlarda (eski Desktop versiyalari, ayrim
 * Android build'lar) bo'sh kelishi mumkin, shuning uchun unga
 * yolg'iz tayanib bo'lmaydi. Uchta belgidan bittasi ham yetarli.
 * Shubha bo'lsa — ilovani ko'rsatamiz, to'sib qo'ymaymiz.
 */
export function isTelegramEnvironment(): boolean {
  const tg = getTelegram()
  if (!tg) return false
  if (tg.initData) return true
  if (tg.initDataUnsafe?.user) return true
  return Boolean(tg.platform && tg.platform !== 'unknown')
}

/**
 * telegram-web-app.js sekin yuklansa (yoki CDN javob bermasa),
 * darhol xulosa chiqarmaymiz — qisqa vaqt kutamiz.
 */
export function waitForTelegram(timeoutMs = 1500): Promise<void> {
  if (window.Telegram?.WebApp) return Promise.resolve()

  return new Promise((resolve) => {
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      if (window.Telegram?.WebApp || Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer)
        resolve()
      }
    }, 50)
  })
}

/**
 * Foydalanuvchi. Telegram tashqarisida FAQAT dev rejimida soxta
 * foydalanuvchi qaytariladi — production'da null (F-06).
 */
export function getTelegramUser(): TelegramUser | null {
  const tg = getTelegram()

  if (tg?.initDataUnsafe?.user) {
    return tg.initDataUnsafe.user
  }

  if (!import.meta.env.DEV) return null

  try {
    const mockUserStr = localStorage.getItem('mockTelegramUser')
    if (mockUserStr) {
      return JSON.parse(mockUserStr) as TelegramUser
    }

    const randomId = Math.floor(Math.random() * 1000000)
    const newMockUser: TelegramUser = {
      id: randomId,
      first_name: 'Test',
      last_name: 'Foydalanuvchi',
      username: `testuser_${randomId}`,
    }
    localStorage.setItem('mockTelegramUser', JSON.stringify(newMockUser))
    return newMockUser
  } catch {
    return null
  }
}

export function initTelegram() {
  const tg = getTelegram()
  if (!tg) return

  tg.ready()
  tg.expand()

  // Xarid jarayonida tasodifan yopilib qolmasin
  tg.enableClosingConfirmation?.()
}

// ── Tema ─────────────────────────────────────────────────────

function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * Telegram temasiga moslashtiramiz.
 *
 * Telegram'ning o'z ranglarini ko'chirib olmaymiz — ular do'kon brendi
 * bilan urishib qolishi mumkin. O'rniga faqat YORUG'/QORONG'I tanlovini
 * olamiz va o'zimizning palitrani qo'llaymiz, so'ng Telegram paneli
 * ranglarini ilova foniga moslaymiz. Natijada yaxlit ko'rinish chiqadi.
 */
export function applyTelegramTheme() {
  const tg = getTelegram()
  const root = document.documentElement

  if (tg?.colorScheme) {
    root.setAttribute('data-theme', tg.colorScheme)
  } else {
    // Telegram tashqarisida tizim tanlovini o'z holiga qoldiramiz
    root.removeAttribute('data-theme')
  }

  // Tokenlar qo'llanib bo'lgach panel ranglarini olamiz
  requestAnimationFrame(() => {
    const surface = readToken('--surface')
    const bg = readToken('--bg')
    if (surface) tg?.setHeaderColor?.(surface)
    if (bg) {
      tg?.setBackgroundColor?.(bg)
      tg?.setBottomBarColor?.(bg)
    }
  })
}

/** Telegram xavfsiz zonasini CSS o'zgaruvchilariga yozamiz. */
export function applySafeArea() {
  const tg = getTelegram()
  const root = document.documentElement

  const bottom =
    tg?.contentSafeAreaInset?.bottom ?? tg?.safeAreaInset?.bottom ?? 0
  const top = tg?.contentSafeAreaInset?.top ?? tg?.safeAreaInset?.top ?? 0

  // env() qiymati mavjud bo'lsa u ham hisobga olinsin
  root.style.setProperty('--safe-bottom', `max(${bottom}px, env(safe-area-inset-bottom, 0px))`)
  root.style.setProperty('--safe-top', `${top}px`)
}

/** Tema va o'lcham o'zgarishlarini kuzatamiz. */
export function watchTelegramAppearance(): () => void {
  const tg = getTelegram()

  const onTheme = () => applyTelegramTheme()
  const onViewport = () => applySafeArea()

  applyTelegramTheme()
  applySafeArea()

  tg?.onEvent?.('themeChanged', onTheme)
  tg?.onEvent?.('viewportChanged', onViewport)
  tg?.onEvent?.('safeAreaChanged', onViewport)
  tg?.onEvent?.('contentSafeAreaChanged', onViewport)

  // Telegram tashqarisida (dev) tizim temasini kuzatamiz
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onMedia = () => {
    if (!getTelegram()) applyTelegramTheme()
  }
  media.addEventListener('change', onMedia)

  return () => {
    tg?.offEvent?.('themeChanged', onTheme)
    tg?.offEvent?.('viewportChanged', onViewport)
    tg?.offEvent?.('safeAreaChanged', onViewport)
    tg?.offEvent?.('contentSafeAreaChanged', onViewport)
    media.removeEventListener('change', onMedia)
  }
}

// ── BackButton ───────────────────────────────────────────────

/**
 * Telegram'ning yuqoridagi "orqaga" tugmasi. Android'da qurilmaning
 * o'z orqaga tugmasi ham shu bilan bog'lanadi — ilgari u butun
 * mini appni yopib yuborardi (D-03).
 */
export function setupBackButton(handler: () => void): () => void {
  const tg = getTelegram()
  if (!tg) return () => {}

  tg.BackButton.onClick(handler)
  return () => tg.BackButton.offClick(handler)
}

export function toggleBackButton(visible: boolean) {
  const tg = getTelegram()
  if (!tg) return
  if (visible) tg.BackButton.show()
  else tg.BackButton.hide()
}

// ── Haptic ───────────────────────────────────────────────────

export function hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light') {
  getTelegram()?.HapticFeedback.impactOccurred(type)
}

export function hapticSuccess() {
  getTelegram()?.HapticFeedback.notificationOccurred('success')
}

export function hapticError() {
  getTelegram()?.HapticFeedback.notificationOccurred('error')
}

export function hapticSelection() {
  getTelegram()?.HapticFeedback.selectionChanged()
}

// ── Boshqalar ────────────────────────────────────────────────

export function getImageUrl(path: string): string {
  return path
}

export function openBotDeepLink(botUsername: string, payload: string) {
  const tg = getTelegram()
  const url = `https://t.me/${botUsername}?start=${payload}`
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(url)
  } else {
    window.open(url, '_blank')
  }
}

export function showAlert(message: string) {
  const tg = getTelegram()
  if (tg?.showAlert) tg.showAlert(message)
  else window.alert(message)
}
