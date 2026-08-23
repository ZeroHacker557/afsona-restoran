import { CheckCircle2, ShoppingBag } from 'lucide-react'
import { useT } from '../../i18n'

type Props = { onViewOrders: () => void }

export function CheckoutSuccess({ onViewOrders }: Props) {
  const t = useT()

  return (
    <div className="checkout-success-overlay" onClick={onViewOrders} role="dialog" aria-modal="true">
      <div className="checkout-success-card" onClick={(e) => e.stopPropagation()}>
        <span
          className="mx-auto grid size-20 place-items-center rounded-full"
          style={{
            background: 'var(--success-soft)',
            color: 'var(--success)',
            animation: 'bounceIn 0.5s ease',
          }}
        >
          <CheckCircle2 size={44} />
        </span>
        <h2 className="mt-6 text-2xl font-extrabold" style={{ color: 'var(--ink)' }}>
          {t('checkout.successTitle')}
        </h2>
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          {t('checkout.successText')}
        </p>
        <button onClick={onViewOrders} className="btn-primary mt-7 w-full py-4">
          <ShoppingBag size={20} />
          {t('checkout.viewOrders')}
        </button>
      </div>
    </div>
  )
}
