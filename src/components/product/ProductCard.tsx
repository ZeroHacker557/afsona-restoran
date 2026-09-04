import { Heart, ShoppingCart, Star } from 'lucide-react'
import { useState } from 'react'
import { formatPrice } from '../../data'
import { getImageUrl } from '../../utils/telegram'
import { useT } from '../../i18n'
import type { Product, ProductActions } from '../../types/domain'

type Props = ProductActions & {
  product: Product
  compact?: boolean
  /**
   * Ekranning yuqorisidagi, darhol ko'rinadigan kartami.
   *
   * `loading="lazy"` ekranda TURGAN rasm uchun ham kechikish beradi:
   * brauzer avval joylashuvni hisoblaydi, keyin yuklashni boshlaydi.
   * Birinchi kartalar uchun buni o'chirib, ustuvorlikni oshiramiz —
   * menyu sezilarli tez ochiladi.
   */
  priority?: boolean
}

export function ProductCard({ product, onOpen, onAddToCart, likedIds, onToggleLike, compact = false, priority = false }: Props) {
  const t = useT()
  const favourite = likedIds.includes(product.id)
  const imgSrc = product.images?.[0] ? getImageUrl(product.images[0]) : ''
  const [imgError, setImgError] = useState(false)
  // Qoldiq tugagan yoki admin stop-listga qo'ygan
  const soldOut = product.stock === 0 || product.available === false

  return (
    <article className={'product-card group ' + (compact ? 'compact' : '')}>
      <button
        className={'product-card-like ' + (favourite ? 'liked' : '')}
        onClick={(e) => { e.stopPropagation(); onToggleLike(product.id) }}
        aria-label={t('favorites.title')}
        aria-pressed={favourite}
      >
        <Heart size={18} fill={favourite ? 'currentColor' : 'none'} />
      </button>

      {soldOut ? (
        <span className="product-card-badge muted">{t('product.soldOut')}</span>
      ) : product.discount ? (
        <span className="product-card-badge">{product.discount}</span>
      ) : null}

      <button className="product-card-body" onClick={() => onOpen(product)}>
        <div className={'product-card-image ' + (soldOut ? 'sold-out' : '')}>
          {imgSrc && !imgError ? (
            <img
              className="product-card-img"
              src={imgSrc}
              alt={product.name}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding="async"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="product-card-placeholder">
              <ShoppingCart size={36} />
            </div>
          )}
        </div>

        <div className="product-card-info">
          <h3 className="product-card-name">{product.name}</h3>
          {!compact && (
            <p className="product-card-rating">
              <Star size={14} fill="var(--warning)" style={{ color: 'var(--warning)' }} />
              {product.rating.toFixed(1)} ({product.reviews})
            </p>
          )}
        </div>
      </button>

      <div className="product-card-footer">
        <div className="product-card-price-block">
          <p className="product-card-price">{formatPrice(product.price)}</p>
          {product.oldPrice && !compact && (
            <p className="product-card-old-price">{formatPrice(product.oldPrice)}</p>
          )}
          {!!product.containerPrice && (
            <p className="product-card-container">
              {t('product.withContainer')} +{formatPrice(product.containerPrice)}
            </p>
          )}
        </div>
        <button
          className="add-button"
          disabled={soldOut}
          onClick={(e) => { e.stopPropagation(); onAddToCart(product) }}
          aria-label={soldOut ? t('product.soldOut') : t('product.addToCart')}
        >
          <ShoppingCart size={18} />
        </button>
      </div>
    </article>
  )
}
