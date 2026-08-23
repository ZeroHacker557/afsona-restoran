import { getImageUrl } from '../../utils/telegram'
import { ShoppingBag } from 'lucide-react'
import type { Product } from '../../types/domain'

type Item = { product: Product; quantity: number; cartKey?: string }

export function OrderImages({ products }: { products: Item[] }) {
  return (
    <div className="flex gap-2">
      {products.slice(0, 3).map((item, i) => (
        <div
          key={item.cartKey ?? `${item.product.id}-${i}`}
          className="grid size-14 place-items-center overflow-hidden rounded-xl border sm:size-16"
          style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}
        >
          {item.product.images?.[0] ? (
            <img
              className="size-full object-contain p-1"
              src={getImageUrl(item.product.images[0])}
              alt={item.product.name}
              loading="lazy"
            />
          ) : (
            <ShoppingBag size={18} style={{ color: 'var(--faint)' }} />
          )}
        </div>
      ))}
      {products.length > 3 && (
        <div
          className="grid size-14 place-items-center rounded-xl border text-xs font-bold sm:size-16"
          style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
        >
          +{products.length - 3}
        </div>
      )}
    </div>
  )
}
