import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * Oddiy modal. Escape va fon bosilishi bilan yopiladi, ochiq turganda
 * sahifa orqasi aylanmaydi.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="adm-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`adm-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="adm-card-head">
          <span className="text-base">{title}</span>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Yopish">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">{children}</div>

        {footer && (
          <div
            className="flex justify-end gap-2 border-t p-4"
            style={{ borderColor: 'var(--line-soft)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
