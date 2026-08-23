import { useMemo, useState } from 'react'
import { ChevronDown, Grid2X2, Package, SlidersHorizontal, X } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { ProductCard } from '../components/product/ProductCard'
import { ProductGridSkeleton } from '../components/ui/ProductCardSkeleton'
import { categoryIcon } from '../utils/category-icons'
import { useT } from '../i18n'
import type { Category, Product, ProductActions } from '../types/domain'

type Props = ProductActions & {
  products: Product[]
  categories: Category[]
  loading: boolean
  cartCount: number
  /** Bosh sahifadan kelgan kategoriya filtri. */
  initialCategory?: string | null
  onSearch: () => void
  onOpenCart: () => void
}

export function CatalogPage({
  products, categories, loading, cartCount, initialCategory, onSearch, onOpenCart, ...actions
}: Props) {
  const t = useT()
  const ALL = t('common.all')

  const [active, setActive] = useState(initialCategory || ALL)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortAscending, setSortAscending] = useState(true)

  const displayCategories = useMemo(
    () => [{ id: -1, name: ALL, icon: 'all' }, ...categories],
    [categories, ALL],
  )

  const shown = useMemo(() => {
    const filtered = active === ALL ? products : products.filter((p) => p.category === active)
    return [...filtered].sort((a, b) => (sortAscending ? a.price - b.price : b.price - a.price))
  }, [active, sortAscending, products, ALL])

  return (
    <>
      <PageHeader title={t('catalog.title')} onSearch={onSearch} onCart={onOpenCart} cartCount={cartCount} />

      {/* Kategoriyalar */}
      <section className="category-strip scrollbar-none mt-6">
        {displayCategories.map((category) => {
          const Icon = category.name === ALL ? Grid2X2 : categoryIcon(category.icon, category.name)
          return (
            <button
              onClick={() => setActive(category.name)}
              key={category.id}
              className={'catalog-category ' + (active === category.name ? 'active' : '')}
            >
              <Icon size={21} />
              <span className="line-clamp-1">{category.name}</span>
            </button>
          )
        })}
      </section>

      {/* Filtrlar */}
      <section className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-10">
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className="filter-button"
          style={filtersOpen ? { borderColor: 'var(--brand-line)', background: 'var(--brand-soft)' } : undefined}
        >
          <SlidersHorizontal size={18} />
          <span>{t('catalog.filters')}</span>
        </button>
        <button onClick={() => setSortAscending((v) => !v)} className="filter-button">
          <span>{sortAscending ? t('catalog.sortCheap') : t('catalog.sortExpensive')}</span>
          <ChevronDown
            size={17}
            className={`transition-transform duration-300 ${!sortAscending ? 'rotate-180' : ''}`}
          />
        </button>
      </section>

      {filtersOpen && (
        <section
          className="mx-5 mt-4 rounded-2xl border p-4 sm:mx-10"
          style={{
            borderColor: 'var(--brand-line)',
            background: 'var(--brand-soft)',
            animation: 'fadeInUp 0.25s ease',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold" style={{ color: 'var(--brand)' }}>
              {t('catalog.filterSummary', {
                category: active,
                sort: sortAscending ? t('catalog.sortAsc') : t('catalog.sortDesc'),
              })}
            </p>
            <button
              onClick={() => setFiltersOpen(false)}
              className="grid size-7 shrink-0 place-items-center rounded-lg"
              style={{ color: 'var(--brand)' }}
              aria-label={t('common.close')}
            >
              <X size={16} />
            </button>
          </div>
        </section>
      )}

      {/* Mahsulotlar */}
      <section className="px-5 pb-32 pt-6 sm:px-10">
        <p style={{ color: 'var(--muted)' }}>{t('catalog.total', { count: shown.length })}</p>

        {loading ? (
          <ProductGridSkeleton />
        ) : shown.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((product) => (
              <ProductCard key={product.id} product={product} {...actions} />
            ))}
          </div>
        ) : (
          <div
            className="mt-8 rounded-2xl border border-dashed p-12 text-center"
            style={{ borderColor: 'var(--line)' }}
          >
            <span
              className="mx-auto grid size-16 place-items-center rounded-full"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
            >
              <Package size={30} />
            </span>
            <p className="mt-4 font-bold" style={{ color: 'var(--ink-2)' }}>
              {products.length === 0 ? t('home.emptyTitle') : t('catalog.emptyCategory')}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
              {products.length === 0 ? t('home.emptyText') : t('catalog.emptyCategoryText')}
            </p>
            {products.length > 0 && active !== ALL && (
              <button onClick={() => setActive(ALL)} className="btn-ghost mx-auto mt-5 px-5 py-2.5 text-sm">
                {t('common.all')}
              </button>
            )}
          </div>
        )}
      </section>
    </>
  )
}
