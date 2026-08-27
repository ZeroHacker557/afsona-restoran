import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Info } from 'lucide-react'
import { subscribeToToasts, type ToastItem } from '../lib/toast'

const ICONS = { ok: Check, error: AlertTriangle, info: Info }

/** Ekranning pastida chiqadigan qisqa xabar. Panelda bitta nusxa turadi. */
export function ToastHost() {
  const [item, setItem] = useState<ToastItem | null>(null)

  useEffect(() => {
    subscribeToToasts(setItem)
    return () => subscribeToToasts(null)
  }, [])

  useEffect(() => {
    if (!item) return
    const timer = setTimeout(() => setItem(null), item.kind === 'error' ? 5000 : 2600)
    return () => clearTimeout(timer)
  }, [item])

  if (!item) return null

  const Icon = ICONS[item.kind]
  return (
    <div
      className="adm-toast"
      style={item.kind === 'error' ? { background: 'var(--danger)', color: '#fff' } : undefined}
      role="status"
    >
      <Icon size={16} />
      <span>{item.text}</span>
    </div>
  )
}
