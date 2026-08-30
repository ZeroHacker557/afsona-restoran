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
  loading,
}: {
  label: string
  value: string
  sub?: string
  icon?: ReactNode
  tone?: string
  /** Ma'lumot hali kelmagan — raqam o'rniga skelet ko'rsatiladi. */
  loading?: boolean
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
      {loading ? (
        <Skeleton className="adm-stat-skeleton" />
      ) : (
        <span className="adm-stat-value">{value}</span>
      )}

      {sub &&
        (loading ? (
          <Skeleton className="mt-1 h-3 w-24" />
        ) : (
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{sub}</span>
        ))}
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

/* ── Skeletlar ──────────────────────────────────────────────
   Ma'lumot kelgunicha bo'sh joyni band qilib turadi: sahifa
   "sakramaydi" va ekranda nol qiymatlar chaqnab o'tmaydi. */

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`adm-skeleton ${className}`} aria-hidden="true" />
}

/** Jadval yoki ro'yxat uchun qatorlar. */
export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-t px-4 py-3"
          style={{ borderColor: 'var(--line-soft)' }}
        >
          <Skeleton className="size-10 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="mt-2 h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

/** Kartochkalar to'ri — taomlar va shunga o'xshash bo'limlar uchun. */
export function CardsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="adm-card overflow-hidden">
          <Skeleton className="h-32 w-full rounded-none" />
          <div className="p-3">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
