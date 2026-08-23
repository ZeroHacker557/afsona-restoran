import { CheckCircle2, X } from 'lucide-react'
import { useT } from '../../i18n'

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  const t = useT()

  return (
    <div className="toast" role="status" aria-live="polite">
      <CheckCircle2 className="shrink-0" style={{ color: 'var(--success)' }} />
      <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{message}</p>
      <button
        onClick={onClose}
        aria-label={t('common.close')}
        className="ml-auto shrink-0 transition hover:opacity-70 active:scale-90"
        style={{ color: 'var(--muted)' }}
      >
        <X size={18} />
      </button>
    </div>
  )
}
