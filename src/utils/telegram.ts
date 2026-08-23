// Telegram WebApp SDK utilities
// https://core.telegram.org/bots/webapps

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      first_name: string
      last_name?: string
      username?: string
      language_code?: string
      photo_url?: string
    }
    query_id?: string
  }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  MainButton: {
    text: string
    color: string
    textColor: string
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
  showPopup: (params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: string; text?: string }> }, callback?: (buttonId: string) => void) => void
  showAlert: (message: string, callback?: () => void) => void
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void
}

// Check if running inside Telegram
export function isTelegram(): boolean {
  return !!window.Telegram?.WebApp?.initData
}

// Get Telegram WebApp instance
export function getTelegram(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null
}

export type TelegramUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

// Get current user info.
// Telegram tashqarisida FAQAT dev rejimida soxta foydalanuvchi qaytariladi —
// production'da null, aks holda har bir tashrif Firestore'ga axlat yozuv
// qo'shib yuboradi (F-06).
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

// Initialize Telegram WebApp
export function initTelegram() {
  const tg = getTelegram()
  if (tg) {
    tg.ready()
    tg.expand()
  }
}

// Send order data to bot
export function sendOrderData(data: string) {
  const tg = getTelegram()
  if (tg) {
    tg.sendData(data)
  }
}

// Haptic feedback
export function hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light') {
  const tg = getTelegram()
  if (tg) {
    tg.HapticFeedback.impactOccurred(type)
  }
}

export function hapticSuccess() {
  const tg = getTelegram()
  if (tg) {
    tg.HapticFeedback.notificationOccurred('success')
  }
}

export function hapticError() {
  const tg = getTelegram()
  if (tg) {
    tg.HapticFeedback.notificationOccurred('error')
  }
}

// Product image URL builder
export function getImageUrl(path: string): string {
  if (path.startsWith('http')) return path
  return path
}

// Open bot with deep link (closes mini app)
export function openBotDeepLink(botUsername: string, payload: string) {
  const tg = getTelegram()
  const url = `https://t.me/${botUsername}?start=${payload}`
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(url)
  } else {
    window.open(url, '_blank')
  }
}
