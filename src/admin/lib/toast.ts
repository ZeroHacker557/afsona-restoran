/**
 * Xabar chiqarish uchun oddiy emitter.
 *
 * Kontekst emas — istalgan joydan (hatto React'dan tashqarida ham)
 * `toast('Saqlandi')` deb chaqirish mumkin. Ko'rsatishni
 * `components/Toast.tsx` dagi ToastHost bajaradi.
 */

export type ToastKind = 'ok' | 'error' | 'info'
export type ToastItem = { id: number; text: string; kind: ToastKind }

let listener: ((item: ToastItem) => void) | null = null
let counter = 0

export function subscribeToToasts(next: ((item: ToastItem) => void) | null) {
  listener = next
}

export function toast(text: string, kind: ToastKind = 'ok') {
  listener?.({ id: ++counter, text, kind })
}

export function toastError(error: unknown) {
  toast(error instanceof Error ? error.message : String(error), 'error')
}
