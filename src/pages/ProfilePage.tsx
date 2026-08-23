import type { LucideIcon } from 'lucide-react'
import { Bell, ChevronRight, CircleHelp, ClipboardList, MapPin, ShieldCheck, Star, UserRound } from 'lucide-react'
import { formatPrice } from '../data'
import { IconButton } from '../components/ui/IconButton'
import { OrderImages } from '../components/order/OrderImages'
import { getTelegramUser } from '../utils/telegram'
import { formatOrderDate } from '../utils/date'
import type { AppPage, Order, UserProfile } from '../types/domain'

const profileOptions: [LucideIcon, string, string][] = [
  [UserRound, 'Shaxsiy ma\'lumotlar', 'Ismingiz va raqamingiz'],
  [MapPin, 'Yetkazib berish manzillarim', 'Saqlangan manzillar'],
  [ClipboardList, 'Buyurtmalar tarixi', 'Barcha buyurtmalar'],
  [Star, 'Baholash va sharhlar', 'Siz qoldirgan baholar'],
  [ShieldCheck, 'Xavfsizlik', 'Parol va himoya'],
  [CircleHelp, 'Yordam va qo\'llab-quvvatlash', 'Savollar va javoblar'],
]

type Props = {
  profile: UserProfile | null
  orders: Order[]
  onNavigate: (page: AppPage) => void
  onNotify: (msg: string) => void
}

export function ProfilePage({ profile, orders, onNavigate, onNotify }: Props) {
  const tgUser = getTelegramUser()
  const userName = profile?.first_name 
    ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}` 
    : tgUser ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}` : 'Foydalanuvchi'
  const userPhone = profile?.phone || (tgUser?.username ? `@${tgUser.username}` : 'Telegram orqali ulangan')
  const lastOrder = orders[0]

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-8 sm:px-10">
        <h1 className="text-3xl font-extrabold" style={{ color: '#111426' }}>Profil</h1>
        <div className="flex gap-1">
          <IconButton label="Bildirishnomalar" onClick={() => onNavigate('notifications')}>
            <Bell />
          </IconButton>
        </div>
      </header>

      {/* Profile Card */}
      <section
        className="mx-5 mt-8 flex items-center gap-5 rounded-[28px] p-6 sm:mx-10 cursor-pointer transition active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #f5f0ff, #fbf9ff)', animation: 'fadeInUp 0.5s ease' }}
        onClick={() => onNavigate('profile_edit')}
      >
        <div className="grid size-20 place-items-center rounded-full overflow-hidden" style={{ background: '#ede9fe', color: '#7c3aed' }}>
          {tgUser?.photo_url ? (
            <img src={tgUser.photo_url} alt="Profile" className="size-full object-cover" />
          ) : (
            <UserRound size={42} fill="currentColor" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-extrabold sm:text-2xl" style={{ color: '#111426' }}>{userName}</h2>
          <p className="mt-1 text-sm" style={{ color: '#64748b' }}>
            {userPhone}
          </p>
        </div>
        <ChevronRight style={{ color: '#94a3b8' }} />
      </section>

      {/* Stats */}
      <section className="mx-5 mt-5 grid grid-cols-3 gap-3 sm:mx-10" style={{ animation: 'fadeInUp 0.5s ease 0.05s both' }}>
        {[
          { label: 'Buyurtmalar', value: orders.length },
          { label: 'Faol', value: orders.filter((o) => o.status === 'Yangi' || o.status === 'Yetkazilmoqda').length },
          { label: 'Bajarilgan', value: orders.filter((o) => o.status === 'Yetkazildi').length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-slate-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-extrabold" style={{ color: '#7c3aed' }}>{value}</p>
            <p className="mt-1 text-xs font-bold" style={{ color: '#64748b' }}>{label}</p>
          </div>
        ))}
      </section>

      {/* Last Order */}
      {lastOrder && (
        <section className="px-5 pt-7 sm:px-10" style={{ animation: 'fadeInUp 0.5s ease 0.1s both' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">Oxirgi buyurtma</h2>
            <button onClick={() => onNavigate('orders')} className="font-bold transition hover:opacity-70" style={{ color: '#7c3aed' }}>
              Barchasini ko'rish
            </button>
          </div>
          <button onClick={() => onNavigate('orders')} className="order-card w-full text-left">
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold truncate text-base" style={{ color: '#111426' }}>
                {lastOrder.products.map(p => p.product.name).join(', ')}
              </h3>
              <p className="mt-1 text-xs font-bold" style={{ color: '#64748b' }}>{lastOrder.orderNumber}</p>
              <div className="mt-2">
                <OrderImages products={lastOrder.products} />
                <p className="mt-1 text-[11px]" style={{ color: '#64748b' }}>{lastOrder.products.length} ta mahsulot</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <strong className="block text-lg" style={{ color: '#111426' }}>{formatPrice(lastOrder.total)}</strong>
              <p className="mt-1 text-xs" style={{ color: '#94a3b8' }}>{formatOrderDate(lastOrder.createdAt) || lastOrder.date}</p>
            </div>
          </button>
        </section>
      )}

      {/* Account Options */}
      <section className="px-5 pb-32 pt-7 sm:px-10" style={{ animation: 'fadeInUp 0.5s ease 0.2s both' }}>
        <h2 className="section-title mb-5">Hisob</h2>
        <div className="rounded-[25px] border border-slate-100 px-5 shadow-sm">
          {profileOptions.map(([Icon, label, subtitle], index) => (
            <button
              key={label}
              onClick={() => {
                if (label.includes('Buyurtmalar')) onNavigate('orders')
                else if (label.includes('Shaxsiy')) onNavigate('profile_edit')
                else if (label.includes('manzillarim')) onNavigate('addresses')
                else if (label.includes('Baholash')) onNavigate('reviews')
                else onNotify(`${label} — tez orada!`)
              }}
              className={'profile-option ' + (index === profileOptions.length - 1 ? 'border-0' : '')}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: '#f5f0ff', color: '#7c3aed' }}>
                <Icon size={20} />
              </span>
              <div className="flex-1 text-left">
                <span className="block" style={{ color: '#111426' }}>{label}</span>
                <span className="block text-xs font-normal" style={{ color: '#94a3b8' }}>{subtitle}</span>
              </div>
              <ChevronRight className="shrink-0" style={{ color: '#94a3b8' }} />
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
