import type { LucideIcon } from 'lucide-react'
import { Grid2X2, Heart, Home, ShoppingBag, UserRound } from 'lucide-react'
import { useT, type TranslationKey } from '../../i18n'
import type { AppPage } from '../../types/domain'

const items: { id: AppPage; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { id: 'home', labelKey: 'nav.home', icon: Home },
  { id: 'catalog', labelKey: 'nav.catalog', icon: Grid2X2 },
  { id: 'favorites', labelKey: 'nav.favorites', icon: Heart },
  { id: 'orders', labelKey: 'nav.orders', icon: ShoppingBag },
  { id: 'profile', labelKey: 'nav.profile', icon: UserRound },
]

type Props = {
  page: AppPage
  onNavigate: (page: AppPage) => void
  cartCount: number
}

export function BottomNav({ page, onNavigate, cartCount }: Props) {
  const t = useT()

  return (
    <nav className="bottom-nav">
      {items.map(({ id, labelKey, icon: Icon }) => {
        const active = page === id
        return (
          <button
            onClick={() => onNavigate(id)}
            key={id}
            aria-current={active ? 'page' : undefined}
            className={'nav-item ' + (active ? 'active' : '')}
          >
            <span className="relative">
              <Icon size={23} fill={active ? 'currentColor' : 'none'} />
              {id === 'orders' && cartCount > 0 && (
                <span
                  className="absolute -right-2 -top-1 grid size-4 place-items-center rounded-full text-[9px] font-bold"
                  style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
                >
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </span>
            <span className="text-center">{t(labelKey)}</span>
          </button>
        )
      })}
    </nav>
  )
}
