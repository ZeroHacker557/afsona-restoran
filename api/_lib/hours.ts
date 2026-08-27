/**
 * Restoran ish vaqti.
 *
 * Sozlama Firestore'dagi `settings/hours` hujjatida turadi va admin panelda
 * o'zgartiriladi. Mijoz savatga taom qo'shaveradi — tekshiruv faqat
 * "Buyurtma berish" bosilganda ishlaydi (shunda savat saqlanib qoladi va
 * mijoz ochilish vaqtini biladi).
 *
 * MUHIM: bu faylning egizagi — `src/utils/hours.ts` (mijoz tomoni).
 * Ikkalasi bir xil qoidani hisoblaydi: mijoz oynada ko'radi, server esa
 * buyurtmani qabul qilishdan oldin qayta tekshiradi. Birini o'zgartirsangiz,
 * ikkinchisini ham yangilang.
 */

export type DayHours = {
  /** Shu kuni dam olish. */
  closed: boolean
  /** "HH:MM" — ochilish. */
  open: string
  /** "HH:MM" — yopilish. Ochilishdan kichik bo'lsa, tunda davom etadi. */
  close: string
}

export type WorkingHours = {
  /** false — ish vaqti tekshirilmaydi, restoran doim ochiq. */
  enabled: boolean
  /** Qo'lda "vaqtincha yopiq" tugmasi. */
  temporarilyClosed: boolean
  /** Yopiq bo'lganda ko'rsatiladigan qo'shimcha izoh. */
  closedNote: string
  /** Vaqt mintaqasi, UTC dan daqiqada. O'zbekiston = +300. */
  tzOffset: number
  /** Yakshanbadan shanbagacha (JS getDay tartibida). */
  days: DayHours[]
}

export const DAY_NAMES_UZ = [
  'Yakshanba',
  'Dushanba',
  'Seshanba',
  'Chorshanba',
  'Payshanba',
  'Juma',
  'Shanba',
]

export const DAY_NAMES_RU = [
  'Воскресенье',
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
]

export const DEFAULT_HOURS: WorkingHours = {
  enabled: false,
  temporarilyClosed: false,
  closedNote: '',
  tzOffset: 300,
  days: Array.from({ length: 7 }, () => ({ closed: false, open: '09:00', close: '23:00' })),
}

/** "HH:MM" → yarim tundan boshlab daqiqalar. Noto'g'ri bo'lsa null. */
export function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function toClock(minutes: number): string {
  const value = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(value / 60)
  const m = value % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Firestore hujjatidan xavfsiz o'qish — bo'sh/eski ma'lumot ham yiqitmaydi. */
export function readHours(raw: unknown): WorkingHours {
  const data = (raw || {}) as Partial<WorkingHours>
  const days = Array.isArray(data.days) ? data.days : []

  return {
    enabled: data.enabled === true,
    temporarilyClosed: data.temporarilyClosed === true,
    closedNote: String(data.closedNote || ''),
    tzOffset: Number.isFinite(Number(data.tzOffset)) ? Number(data.tzOffset) : 300,
    days: Array.from({ length: 7 }, (_, i) => {
      const day = (days[i] || {}) as Partial<DayHours>
      return {
        closed: day.closed === true,
        open: toMinutes(String(day.open)) === null ? '09:00' : String(day.open),
        close: toMinutes(String(day.close)) === null ? '23:00' : String(day.close),
      }
    }),
  }
}

export type OpenState = {
  open: boolean
  /** Nima uchun yopiq. */
  reason: 'open' | 'temporarily' | 'day-off' | 'before-open' | 'after-close'
  /** Keyingi ochilish vaqti "HH:MM", topilmasa null. */
  opensAt: string | null
  /** Keyingi ochilish qaysi kun (0 — bugun, 1 — ertaga …). */
  opensInDays: number
  /** Bugungi ish vaqti matni, masalan "09:00 – 23:00". */
  todayText: string
}

/** Restoran ayni damda ochiqmi. */
export function getOpenState(hours: WorkingHours, now: Date = new Date()): OpenState {
  const todayText = describeDay(hours, localDay(hours, now))

  if (!hours.enabled) return { open: true, reason: 'open', opensAt: null, opensInDays: 0, todayText }
  if (hours.temporarilyClosed) {
    const next = findNextOpening(hours, now)
    return { open: false, reason: 'temporarily', ...next, todayText }
  }

  const minutes = localMinutes(hours, now)
  const dayIndex = localDay(hours, now)

  // Kecha boshlangan va yarim tundan oshgan smena (masalan 18:00 – 02:00)
  const yesterday = hours.days[(dayIndex + 6) % 7]
  if (!yesterday.closed) {
    const open = toMinutes(yesterday.open)!
    const close = toMinutes(yesterday.close)!
    if (close <= open && minutes < close) {
      return { open: true, reason: 'open', opensAt: null, opensInDays: 0, todayText }
    }
  }

  const today = hours.days[dayIndex]
  if (today.closed) {
    const next = findNextOpening(hours, now)
    return { open: false, reason: 'day-off', ...next, todayText }
  }

  const open = toMinutes(today.open)!
  const close = toMinutes(today.close)!
  const overnight = close <= open

  const isOpen = overnight ? minutes >= open : minutes >= open && minutes < close
  if (isOpen) return { open: true, reason: 'open', opensAt: null, opensInDays: 0, todayText }

  if (minutes < open) {
    return { open: false, reason: 'before-open', opensAt: today.open, opensInDays: 0, todayText }
  }

  const next = findNextOpening(hours, now)
  return { open: false, reason: 'after-close', ...next, todayText }
}

/** Keyingi ochilish payti — bir hafta oldinga qaraydi. */
function findNextOpening(hours: WorkingHours, now: Date): { opensAt: string | null; opensInDays: number } {
  const dayIndex = localDay(hours, now)
  const minutes = localMinutes(hours, now)

  for (let offset = 0; offset < 8; offset++) {
    const day = hours.days[(dayIndex + offset) % 7]
    if (day.closed) continue
    const open = toMinutes(day.open)!
    if (offset === 0 && minutes >= open) continue
    return { opensAt: day.open, opensInDays: offset }
  }
  return { opensAt: null, opensInDays: 0 }
}

/** Restoran mintaqasidagi hafta kuni (0 — yakshanba). */
export function localDay(hours: WorkingHours, now: Date = new Date()): number {
  return shifted(hours, now).getUTCDay()
}

/** Restoran mintaqasidagi vaqt — yarim tundan boshlab daqiqalar. */
export function localMinutes(hours: WorkingHours, now: Date = new Date()): number {
  const date = shifted(hours, now)
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

/** UTC vaqtini restoran mintaqasiga suradi (UTC metodlari bilan o'qish uchun). */
function shifted(hours: WorkingHours, now: Date): Date {
  return new Date(now.getTime() + hours.tzOffset * 60000)
}

export function describeDay(hours: WorkingHours, dayIndex: number): string {
  const day = hours.days[dayIndex]
  if (!day || day.closed) return 'Dam olish kuni'
  return `${day.open} – ${day.close}`
}
