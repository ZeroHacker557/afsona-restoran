import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, ShoppingBag, X } from 'lucide-react'
import { formatPrice } from '../../data'
import { formatOrderDate } from '../../utils/date'
import { getImageUrl } from '../../utils/telegram'
import { useT } from '../../i18n'
import type { Order } from '../../types/domain'

/**
 * Mijozga ko'rinadigan chek — buyurtma tafsilotidan ochiladi.
 *
 * Bu "chop etish uchun chek" emas: mijoz uni ekranda ko'radi, shuning
 * uchun ilovaning o'z dizayni bilan bir uslubda, animatsiya bilan
 * ochiladi. Chekning yon chekkalari kertikli — qog'oz chek taassurotini
 * beradi (mask qo'llab-quvvatlanmasa oddiy burchak bo'lib qoladi,
 * ko'rinish buzilmaydi).
 *
 * Nega portal: sahifa `.page-animate` ichida chiziladi, u esa transform
 * animatsiyasi tufayli o'z stacking-kontekstini yaratadi. Shu sababli
 * ichkarida turgan `position: fixed` element viewportga emas, o'sha
 * blokka bo'ysunadi va pastki menyu (z-index 20) uning ustiga chiqib
 * qolardi. `document.body` ga chiqarilganda bu muammo yo'qoladi.
 */

type Props = {
  order: Order
  onClose: () => void
}

const CANCELLED = ['Bekor qilingan', 'Rad etildi']

export function OrderReceipt({ order, onClose }: Props) {
  const t = useT()
  const cancelled = CANCELLED.includes(order.status)

  // Orqa fon aylanmasin va pastki menyu ko'rinmasin — chek ochiq
  // turganda ekranda faqat chek qolsin.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('receipt-open')
    return () => {
      document.body.style.overflow = previous
      document.body.classList.remove('receipt-open')
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const subtotal =
    order.subtotal ??
    order.products.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  return createPortal(
    <div className="receipt-overlay" role="dialog" aria-modal="true">
      <button className="receipt-close" onClick={onClose} aria-label={t('common.close')}>
        <X size={20} />
      </button>

      {/* ── Sarlavha ─────────────────────────────── */}
      <div className="receipt-head">
        <span className="receipt-mark">
          {cancelled ? <X size={44} strokeWidth={3} /> : <Check size={44} strokeWidth={3} />}
        </span>

        {/* Bayram nuqtalari — bekor qilingan buyurtmada ko'rsatilmaydi */}
        {!cancelled && (
          <div className="receipt-confetti" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => (
              <i key={index} style={{ '--i': index } as React.CSSProperties} />
            ))}
          </div>
        )}

        <h2 className="receipt-title">
          {cancelled ? t('receipt.cancelledTitle') : t('receipt.title')}
        </h2>
        <p className="receipt-subtitle">
          {cancelled
            ? t('receipt.cancelledText')
            : order.status === 'Yetkazildi'
              ? t('receipt.textDelivered')
              : t('receipt.text')}
        </p>
      </div>

      {/* ── Chek ─────────────────────────────────── */}
      <div className="receipt-ticket">
        <div className="receipt-row-head">
          <span className="receipt-icon">
            <ShoppingBag size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="receipt-number">{order.orderNumber}</p>
            <p className="receipt-date">{formatOrderDate(order.createdAt) || order.date}</p>
          </div>
          <span className={`receipt-chip${cancelled ? ' danger' : ''}`}>{order.status}</span>
        </div>

        <div className="receipt-dashed" />

        <p className="receipt-section">{t('receipt.summary')}</p>

        <div className="receipt-items">
          {order.products.map((item, index) => (
            <div className="receipt-item" key={item.cartKey ?? index}>
              {item.product.images?.[0] ? (
                <img
                  src={getImageUrl(item.product.images[0])}
                  alt={item.product.name}
                  loading="lazy"
                  className="receipt-thumb"
                />
              ) : (
                <span className="receipt-thumb receipt-thumb-empty" />
              )}
              <div className="min-w-0 flex-1">
                <p className="receipt-item-name">{item.product.name}</p>
                <p className="receipt-item-qty">×{item.quantity}</p>
              </div>
              <p className="receipt-item-price">
                {formatPrice(item.product.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        <div className="receipt-dashed" />

        <div className="receipt-totals">
          <div className="receipt-line">
            <span>{t('checkout.products')}</span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          {!!order.deliveryFee && (
            <div className="receipt-line">
              <span>{t('checkout.delivery')}</span>
              <span>{formatPrice(order.deliveryFee)}</span>
            </div>
          )}

          {!!order.discount && (
            <div className="receipt-line discount">
              <span>
                {t('checkout.discount')}
                {order.promoCode ? ` · ${order.promoCode}` : ''}
              </span>
              <span>− {formatPrice(order.discount)}</span>
            </div>
          )}
        </div>

        <div className="receipt-total">
          <span>{t('receipt.total')}</span>
          <b>{formatPrice(order.total)}</b>
        </div>
      </div>

      <button className="receipt-button" onClick={onClose}>
        {t('receipt.close')}
      </button>
    </div>,
    document.body,
  )
}
