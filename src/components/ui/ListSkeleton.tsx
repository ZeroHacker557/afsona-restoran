/**
 * Ro'yxat yuklanayotganda ko'rsatiladigan skelet.
 *
 * Nega kerak: Firestore birinchi javobini bir necha yuz millisekunddan
 * keyin beradi. Shu oraliqda ro'yxat bo'sh bo'ladi va ekranda
 * "buyurtmalar yo'q" chaqnab o'tadi — foydalanuvchida ma'lumoti
 * yo'qolganday taassurot qoldiradi.
 *
 * Skelet buni yopadi va sahifa "sakramaydi": bo'sh joy oldindan
 * band qilinadi, ma'lumot kelganda o'lcham o'zgarmaydi.
 */
export function OrderCardSkeleton() {
  return (
    <div className="order-card flex-col gap-3" aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <span className="skeleton h-3 w-24" />
        <span className="skeleton h-3 w-20" />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="skeleton block h-4 w-4/5" />
          <span className="skeleton mt-2 block h-3 w-20" />
        </div>
        <span className="skeleton h-4 w-24" />
      </div>

      <div className="border-t pt-2.5" style={{ borderColor: 'var(--line-soft)' }}>
        <div className="flex items-center justify-between">
          <span className="skeleton h-3 w-16" />
          <span className="skeleton h-3 w-20" />
        </div>
      </div>
    </div>
  )
}

export function OrderListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, index) => (
        <OrderCardSkeleton key={index} />
      ))}
    </div>
  )
}

/** Bildirishnomalar uchun — bir qatorli, ixchamroq. */
export function NotificationListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex items-start gap-3 rounded-2xl p-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}
        >
          <span className="skeleton size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <span className="skeleton block h-3.5 w-2/5" />
            <span className="skeleton mt-2 block h-3 w-full" />
            <span className="skeleton mt-1.5 block h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
