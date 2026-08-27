import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

/** Panelning mayda qayta ishlatiluvchi bo'laklari. */

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 text-left"
      aria-pressed={checked}
    >
      <span className={`adm-switch ${checked ? 'on' : ''}`} />
      {(label || hint) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-semibold">{label}</span>}
          {hint && <span className="block text-xs" style={{ color: 'var(--muted)' }}>{hint}</span>}
        </span>
      )}
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="adm-label">{label}</span>
      {children}
      {hint && <span className="adm-hint block">{hint}</span>}
    </label>
  )
}

export function Chip({
  children,
  color = 'var(--muted)',
  background = 'var(--surface-3)',
}: {
  children: ReactNode
  color?: string
  background?: string
}) {
  return (
    <span className="adm-chip" style={{ color, background }}>
      {children}
    </span>
  )
}

export function Empty({ text, icon }: { text: string; icon?: ReactNode }) {
  return (
    <div className="adm-empty">
      {icon ?? <Inbox size={30} strokeWidth={1.6} />}
      <span className="text-sm font-medium">{text}</span>
    </div>
  )
}

export function Spinner({ center }: { center?: boolean }) {
  if (!center) return <span className="adm-spinner" />
  return (
    <div className="flex justify-center py-16">
      <span className="adm-spinner" style={{ height: 26, width: 26 }} />
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string
  value: string
  sub?: string
  icon?: ReactNode
  tone?: string
}) {
  return (
    <div className="adm-stat">
      <div className="flex items-center justify-between">
        <span className="adm-stat-label">{label}</span>
        {icon && (
          <span
            className="grid size-8 place-items-center rounded-[10px]"
            style={{ background: tone || 'var(--brand-soft)', color: tone ? 'inherit' : 'var(--brand)' }}
          >
            {icon}
          </span>
        )}
      </div>
      <span className="adm-stat-value">{value}</span>
      {sub && <span className="text-xs" style={{ color: 'var(--muted)' }}>{sub}</span>}
    </div>
  )
}

/** Ha/yo'q so'roviga o'xshash oddiy tasdiq — brauzer confirm o'rniga. */
export function ConfirmBar({
  text,
  confirmText = "Ha, o'chirilsin",
  onConfirm,
  onCancel,
  busy,
}: {
  text: string
  confirmText?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-[var(--r-md)] p-3"
      style={{ background: 'var(--danger-soft)' }}
    >
      <span className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
        {text}
      </span>
      <div className="ml-auto flex gap-2">
        <button className="adm-btn sm" onClick={onCancel} disabled={busy}>
          Bekor
        </button>
        <button className="adm-btn danger sm" onClick={onConfirm} disabled={busy}>
          {busy ? <Spinner /> : confirmText}
        </button>
      </div>
    </div>
  )
}
