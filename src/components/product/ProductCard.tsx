import { Heart, ShoppingCart, Star } from 'lucide-react'
import { formatPrice } from '../../data'
import { getImageUrl } from '../../utils/telegram'
import type { Product, ProductActions } from '../../types/domain'
import { useState } from 'react'

type Props = ProductActions & { product: Product; compact?: boolean }

export function ProductCard({ product, onOpen, onAddToCart, likedIds, onToggleLike, compact = false }: Props) {
  const favourite = likedIds.includes(product.id)
  const imgSrc = product.images?.[0] ? getImageUrl(product.images[0]) : ''
  const [imgError, setImgError] = useState(false)
  // stock undefined bo'lsa ombor hisobi yuritilmaydi (eski mahsulotlar)
  const soldOut = product.stock === 0

  const imageHeight = compact ? 'h-36' : 'h-48 sm:h-56'

  return (
    <article className={'product-card group ' + (compact ? 'compact' : '')}>
      {/* Like Button */}
      <button
        className="product-card-like"
        style={{ color: favourite ? '#6c20f5' : '#111426' }}
        onClick={(e) => { e.stopPropagation(); onToggleLike(product.id) }}
        aria-label="Sevimliga qo'shish"
      >
        <Heart size={18} fill={favourite ? '#6c20f5' : 'none'} />
      </button>

      {/* Discount Badge */}
      {!soldOut && product.discount && (
        <span className="product-card-badge">
          {product.discount}
        </span>
      )}

      {soldOut && (
        <span className="product-card-badge" style={{ background: '#64748b' }}>
          Sotuvda yo&rsquo;q
        </span>
      )}

      {/* Clickable Area: Image + Info */}
      <button className="product-card-body" onClick={() => onOpen(product)}>
        {/* Image Container - always takes fixed space */}
        <div className={`product-card-image ${imageHeight}`} style={soldOut ? { opacity: 0.45 } : undefined}>
          {imgSrc && !imgError ? (
            <img
              className="product-card-img"
              src={imgSrc}
              alt={product.name}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="product-card-placeholder">
              <ShoppingCart size={36} />
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="product-card-info">
          <h3 className="product-card-name">{product.name}</h3>
          {!compact && (
            <p className="product-card-rating">
              <Star size={14} fill="#ffb000" style={{ color: '#fbbf24' }} />
              {product.rating.toFixed(1)} ({product.reviews})
            </p>
          )}
        </div>
      </button>

      {/* Price & Add to Cart */}
      <div className="product-card-footer">
        <div className="product-card-price-block">
          <p className="product-card-price">{formatPrice(product.price)}</p>
          {product.oldPrice && !compact && (
            <p className="product-card-old-price">{formatPrice(product.oldPrice)}</p>
          )}
        </div>
        <button
          className="add-button"
          disabled={soldOut}
          onClick={(e) => { e.stopPropagation(); onAddToCart(product) }}
          aria-label={soldOut ? "Sotuvda yo'q" : "Savatchaga qo'shish"}
          style={soldOut ? { background: '#e2e8f0', color: '#94a3b8', cursor: 'not-allowed' } : undefined}
        >
          <ShoppingCart size={18} />
        </button>
      </div>
    </article>
  )
}
