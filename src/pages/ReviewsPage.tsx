import { useState, useEffect } from 'react'
import { ChevronLeft, Star, MessageSquare } from 'lucide-react'
import type { UserProfile, Review, AppPage } from '../types/domain'
import { subscribeToUserReviews } from '../lib/firebase'
import { getTelegramUser } from '../utils/telegram'
import { formatDate } from '../utils/date'

type Props = {
  profile: UserProfile | null
  onNavigate: (page: AppPage) => void
}

export function ReviewsPage({ profile, onNavigate }: Props) {
  const tgUser = getTelegramUser()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tgUser) {
      setLoading(false)
      return
    }

    const unsub = subscribeToUserReviews(tgUser.id, (fetchedReviews) => {
      setReviews(fetchedReviews)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  return (
    <>
      <header className="flex items-center gap-3 px-5 pt-8 sm:px-10">
        <button
          onClick={() => onNavigate('profile')}
          className="grid size-11 place-items-center rounded-2xl transition hover:bg-violet-50 active:scale-90"
          style={{ color: '#111426' }}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-extrabold" style={{ color: '#111426' }}>Mening sharhlarim</h1>
      </header>

      <div className="px-5 pt-6 pb-32 sm:px-10 page-animate">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600"></div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="grid size-16 place-items-center rounded-full bg-slate-100 mb-4 text-slate-400">
              <MessageSquare size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Sharhlar yo'q</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-[200px]">Siz hali birorta ham mahsulotga sharh qoldirmagansiz.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">Mahsulot ID: {review.productId}</span>
                  <span className="text-xs text-slate-400">{formatDate(review.date)}</span>
                </div>
                
                <div className="flex gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} 
                      size={16} 
                      fill={star <= review.rating ? "#fbbf24" : "none"} 
                      color={star <= review.rating ? "#fbbf24" : "#cbd5e1"} 
                    />
                  ))}
                </div>
                
                {review.comment && (
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
