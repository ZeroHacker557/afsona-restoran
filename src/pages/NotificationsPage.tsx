import { ArrowLeft, Bell, BellRing, Package, Tag, Info } from 'lucide-react'
import type { AppPage, Notification } from '../types/domain'
import { formatDateTime } from '../utils/date'

type Props = {
  notifications: Notification[]
  onBack: () => void
  onNavigate: (page: AppPage) => void
}

export function NotificationsPage({ notifications, onBack }: Props) {
  return (
    <div className="min-h-screen bg-[#f4f3f8] pb-10">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-8 sm:px-10 page-animate">
        <button
          onClick={onBack}
          className="grid size-11 place-items-center rounded-2xl transition hover:bg-violet-50 active:scale-90"
          style={{ color: '#111426', background: '#fff' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-extrabold" style={{ color: '#111426' }}>Bildirishnomalar</h1>
      </header>

      {/* Notifications List */}
      <div className="px-5 pt-6 sm:px-10 page-animate">
        {notifications.length === 0 ? (
          <div className="mt-20 flex flex-col items-center justify-center text-center">
            <div className="grid size-20 place-items-center rounded-full bg-slate-100 text-slate-400">
              <Bell size={32} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">Bildirishnomalar yo'q</h3>
            <p className="mt-1 text-sm text-slate-500">
              Hozircha sizga hech qanday xabar kelmagan.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => {
              let Icon = BellRing
              let iconColor = '#7c3aed'
              let iconBg = '#ede9fe'

              if (notif.type === 'order') {
                Icon = Package
                iconColor = '#3b82f6'
                iconBg = '#eff6ff'
              } else if (notif.type === 'promo') {
                Icon = Tag
                iconColor = '#10b981'
                iconBg = '#ecfdf5'
              } else if (notif.type === 'system') {
                Icon = Info
                iconColor = '#f59e0b'
                iconBg = '#fffbeb'
              }

              return (
                <div
                  key={notif.id}
                  className={`flex gap-4 rounded-2xl p-4 shadow-sm transition ${notif.read ? 'bg-white opacity-80' : 'bg-white border-l-4 border-[#7c3aed]'}`}
                >
                  <div
                    className="grid size-10 shrink-0 place-items-center rounded-full"
                    style={{ background: iconBg, color: iconColor }}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-[#111426]">{notif.title}</h3>
                    <p className="mt-1 text-xs text-[#64748b] leading-relaxed">{notif.body}</p>
                    <p className="mt-2 text-[10px] font-medium text-[#94a3b8]">{formatDateTime(notif.date)}</p>
                  </div>
                  {!notif.read && (
                    <div className="mt-1 size-2 rounded-full bg-red-500 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
