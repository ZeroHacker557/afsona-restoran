/** Panel bo'ylab bir xil formatlash. */

export function money(amount: unknown): string {
  const value = Math.round(Number(amount) || 0)
  return `${value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')} so'm`
}

export function shortMoney(amount: unknown): string {
  const value = Math.round(Number(amount) || 0)
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')} mln`
  if (value >= 10_000) return `${Math.round(value / 1000)} ming`
  return value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')
}

const MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
]

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}`
}

/** "5 daqiqa oldin" ko'rinishi — yangi buyurtmalarni tez ajratish uchun. */
export function timeAgo(iso: string): string {
  const time = Date.parse(iso)
  if (!time) return '—'
  const diff = Math.max(Date.now() - time, 0)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'hozirgina'
  if (minutes < 60) return `${minutes} daqiqa oldin`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} soat oldin`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} kun oldin`
  return formatDateTime(iso)
}

export function dayKey(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dayLabel(key: string): string {
  const [, month, day] = key.split('-')
  return `${Number(day)}.${month}`
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || '?'
  )
}
