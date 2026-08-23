import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Heart, Minus, Plus, ShoppingCart, Star, Truck, UserRound, MessageSquare } from 'lucide-react'
import { formatPrice } from '../data'
import { getImageUrl, hapticSuccess, getTelegramUser } from '../utils/telegram'
import { CartButton } from '../components/ui/CartButton'
import type { Product, Review } from '../types/domain'
import { addReview, subscribeToProductReviews } from '../lib/firebase'
import { formatDate } from '../utils/date'

type Props = {
  product: Product
  onAddToCart: (product: Product, size?: string, color?: string) => void
  onBack: () => void
  likedIds: number[]
  onToggleLike: (id: number) => void
  onOpenCart: () => void
  cartCount: number
}

export function ProductDetailPage({ product, onAddToCart, onBack, likedIds, onToggleLike, onOpenCart, cartCount }: Props) {
  const [activeImage, setActiveImage] = useState(0)
  const [count, setCount] = useState(1)
  const colorsList = product.colors || (product.color ? product.color.split(',').map(c => c.trim()).filter(Boolean) : [])
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || '')
  const [selectedColor, setSelectedColor] = useState(colorsList[0] || '')
  const favourite = likedIds.includes(product.id)
  const images = product.images || []

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([])
  const [userRating, setUserRating] = useState(0)
  const [userComment, setUserComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const tgUser = getTelegramUser()

  useEffect(() => {
    const unsub = subscribeToProductReviews(product.id, (fetched) => {
      setReviews(fetched)
    })
    return () => unsub()
  }, [product.id])

  // Calculate dynamic rating
  const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0)
  const avgRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : product.rating.toFixed(1)
  const reviewCount = reviews.length > 0 ? reviews.length : product.reviews

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tgUser) return alert("Faqat ro'yxatdan o'tgan foydalanuvchilar sharh qoldirishi mumkin")
    if (userRating === 0) return alert("Iltimos, yulduzchalar orqali baholang")

    setIsSubmitting(true)
    const newReview: Omit<Review, 'id'> = {
      productId: product.id,
      userId: tgUser.id,
      userName: `${tgUser.first_name} ${tgUser.last_name || ''}`.trim(),
      rating: userRating,
      comment: userComment.trim(),
      date: new Date().toISOString()
    }

    try {
      await addReview(newReview)
      hapticSuccess()
      setUserRating(0)
      setUserComment('')
    } catch (e) {
      alert("Xatolik yuz berdi")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddToCart = () => {
    for (let i = 0; i < count; i++) onAddToCart(product, selectedSize, selectedColor)
    setCount(1)
  }

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-8 sm:px-10 page-animate">
        <button onClick={onBack} className="grid size-11 place-items-center rounded-2xl transition hover:bg-violet-50 active:scale-90" style={{ color: '#111426' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-lg font-bold" style={{ color: '#111426' }}>Mahsulot</h2>
        <div className="flex gap-1">
          <button onClick={() => onToggleLike(product.id)} className="grid size-11 place-items-center rounded-2xl transition hover:bg-violet-50 active:scale-90" style={{ color: favourite ? '#6c20f5' : '#111426' }}>
            <Heart size={22} fill={favourite ? '#6c20f5' : 'none'} />
          </button>
          <CartButton count={cartCount} onClick={onOpenCart} />
        </div>
      </header>

      {/* Image */}
      <section className="relative mx-auto mt-3 max-w-3xl px-5" style={{ animation: 'fadeInUp 0.5s ease' }}>
        {product.discount && (
          <span className="absolute left-8 top-7 z-10 rounded-lg px-2.5 py-1 text-xs font-bold shadow-md" style={{ background: '#f43f5e', color: '#fff' }}>
            {product.discount}
          </span>
        )}
        {images[activeImage] ? (
          <img className="mx-auto h-[280px] w-full object-contain sm:h-[400px]" src={getImageUrl(images[activeImage])} alt={product.name} />
        ) : (
          <div className="mx-auto grid h-[280px] w-full place-items-center sm:h-[400px]" style={{ color: '#cbd5e1' }}>
            <ShoppingCart size={60} />
          </div>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
            {images.map((_, i) => (
              <button key={i} onClick={() => setActiveImage(i)} className={'dot ' + (activeImage === i ? 'active' : '')} />
            ))}
          </div>
        )}
      </section>

      {/* Info */}
      <section className="mx-5 mt-5 rounded-t-[28px] border-t border-slate-100 pb-40 pt-7 sm:mx-10 page-animate">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold" style={{ color: '#7c3aed' }}>
            {product.category}
            <span className="ml-1 inline-grid size-4 place-items-center rounded-full text-[9px]" style={{ background: '#2563eb', color: '#fff' }}>✓</span>
          </span>
          <span className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold" style={{ background: '#f5f0ff', color: '#6d28d9' }}>
            <Truck size={18} /> Tez yetkazib berish
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-extrabold sm:text-3xl" style={{ color: '#111426' }}>{product.name}</h1>

        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm" style={{ color: '#64748b' }}>
          <Star size={19} fill="#ffb000" style={{ color: '#fbbf24' }} />
          {avgRating} ({reviewCount} ta baho)
        </p>

        <div className="mt-6 flex items-baseline gap-3">
          <strong className="text-3xl" style={{ color: '#111426' }}>{formatPrice(product.price)}</strong>
          {product.oldPrice && <del style={{ color: '#94a3b8' }}>{formatPrice(product.oldPrice)}</del>}
        </div>

        {/* Colors */}
        {colorsList.length > 0 && (
          <section className="detail-panel">
            <b style={{ color: '#111426' }}>Rangni tanlang</b>
            <div className="mt-4 flex flex-wrap gap-3">
              {colorsList.map((c) => (
                <button 
                  onClick={() => setSelectedColor(c)} 
                  className={'size-chip ' + (selectedColor === c ? 'active' : '')} 
                  key={c}
                >
                  <b>{c}</b>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Sizes */}
        {product.sizes && product.sizes.length > 0 && (
          <section className="detail-panel">
            <b style={{ color: '#111426' }}>Razmerni tanlang</b>
            <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-7">
              {product.sizes.map((s) => (
                <button onClick={() => setSelectedSize(s)} className={'size-chip ' + (selectedSize === s ? 'active' : '')} key={s}>
                  <b>{s}</b>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Description */}
        {product.description && (
          <section className="detail-panel">
            <b style={{ color: '#111426' }}>Mahsulot haqida</b>
            <p className="mt-4 text-sm leading-7" style={{ color: '#64748b' }}>{product.description}</p>
          </section>
        )}

        {/* Reviews Section */}
        <section className="mt-8">
          <h3 className="text-xl font-bold" style={{ color: '#111426' }}>Sharhlar</h3>
          
          {/* Write Review Form */}
          <form onSubmit={handleSubmitReview} className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-700 mb-2">Mahsulotni baholang:</p>
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star} 
                  type="button" 
                  onClick={() => setUserRating(star)}
                  className="transition hover:scale-110 active:scale-95"
                >
                  <Star 
                    size={28} 
                    fill={star <= userRating ? "#fbbf24" : "none"} 
                    color={star <= userRating ? "#fbbf24" : "#cbd5e1"} 
                  />
                </button>
              ))}
            </div>
            
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 focus-within:border-purple-300 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
              <MessageSquare size={20} className="mt-0.5 shrink-0 text-slate-400" />
              <textarea
                value={userComment}
                onChange={(e) => setUserComment(e.target.value)}
                placeholder="O'z fikringizni yozib qoldiring (ixtiyoriy)..."
                rows={2}
                className="w-full resize-none bg-transparent text-sm text-slate-800 outline-none"
              />
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting || userRating === 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white transition hover:bg-purple-700 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? "Yuborilmoqda..." : "Sharh qoldirish"}
            </button>
          </form>

          {/* Reviews List */}
          <div className="mt-6 space-y-4">
            {reviews.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-4">Hozircha sharhlar yo'q. Birinchi bo'lib baholang!</p>
            ) : (
              reviews.map(review => (
                <div key={review.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <div className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-500">
                      <UserRound size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{review.userName}</p>
                      <p className="text-xs text-slate-400">{formatDate(review.date)}</p>
                    </div>
                    <div className="ml-auto flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star} 
                          size={14} 
                          fill={star <= review.rating ? "#fbbf24" : "none"} 
                          color={star <= review.rating ? "#fbbf24" : "#cbd5e1"} 
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed ml-10">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </section>

      {/* Bottom Bar via Portal to avoid CSS containing block issues */}
      {createPortal(
        <div className="fixed bottom-0 left-0 right-0 z-[100] border-t p-4" style={{ borderColor: '#f1f5f9', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)' }}>
          <div className="mx-auto flex max-w-[1120px] items-center gap-3 sm:gap-4">
            <div className="hidden sm:block">
              <b className="text-xl" style={{ color: '#111426' }}>{formatPrice(product.price)}</b>
            </div>
            <div className="flex items-center gap-2 rounded-2xl p-1.5 sm:gap-3 sm:p-2" style={{ background: '#f8fafc' }}>
              <button onClick={() => setCount(Math.max(1, count - 1))} className="grid size-8 place-items-center rounded-lg transition hover:bg-white active:scale-90" style={{ color: '#111426' }}>
                <Minus size={18} />
              </button>
              <b className="w-5 text-center" style={{ color: '#111426' }}>{count}</b>
              <button onClick={() => setCount(count + 1)} className="grid size-8 place-items-center rounded-lg transition hover:bg-white active:scale-90" style={{ color: '#111426' }}>
                <Plus size={18} />
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              className="ml-auto flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 font-bold shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] sm:gap-3 sm:py-4"
              style={{ background: 'linear-gradient(135deg, #6d28d9, #7c3aed)', color: '#fff', boxShadow: '0 8px 24px rgba(109, 40, 217, 0.25)' }}
            >
              <ShoppingCart size={20} />
              <span className="text-sm sm:text-base">Savatchaga qo'shish</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
