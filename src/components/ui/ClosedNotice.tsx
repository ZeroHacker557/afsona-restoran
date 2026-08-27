import { Clock } from 'lucide-react'
import { useT } from '../../i18n'
import { DAY_NAMES_RU, DAY_NAMES_UZ, localDay, type OpenState, type WorkingHours } from '../../utils/hours'

/**
 * "Restoran yopiq" oynasi.
 *
 * Buyurtma berish bosilganda chiqadi. Savat tegilmaydi — mijoz qachon
 * ochilishimizni ko'radi va keyin qaytadan urinadi.
 */
export function ClosedNotice({
  state,
  hours,
  onClose,
}: {
  state: OpenState
  hours: WorkingHours
  onClose: () => void
}) {
  const t = useT()
  const lang = (localStorage.getItem('shopOnlineLang') ?? 'uz') as 'uz' | 'ru'
  const dayNames = lang === 'ru' ? DAY_NAMES_RU : DAY_NAMES_UZ

  const reason =
    state.reason === 'temporarily' ? t('closed.temporarily')
    : state.reason === 'day-off' ? t('closed.dayOff')
    : state.reason === 'before-open' ? t('closed.beforeOpen')
    : t('closed.afterClose')

  let when = ''
  if (state.opensAt) {
    if (state.opensInDays === 0) when = t('closed.opensToday', { time: state.opensAt })
    else if (state.opensInDays === 1) when = t('closed.opensTomorrow', { time: state.opensAt })
    else {
      const dayIndex = (localDay(hours) + state.opensInDays) % 7
      when = t('closed.opensLater', { day: dayNames[dayIndex], time: state.opensAt })
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      style={{ background: 'rgb(10 8 20 / 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-[24px] p-6 text-center sm:rounded-[24px]"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-lg)', animation: 'fadeInUp 0.25s ease' }}
        onClick={(event) => event.stopPropagation()}
      >
        <span
          className="mx-auto grid size-14 place-items-center rounded-2xl"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
        >
          <Clock size={26} />
        </span>

        <h2 className="mt-4 text-lg font-extrabold" style={{ color: 'var(--ink)' }}>
          {t('closed.title')}
        </h2>

        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {reason}
          {when ? ` ${when}` : ''}
        </p>

        {hours.closedNote && (
          <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--brand)' }}>
            {hours.closedNote}
          </p>
        )}

        {state.reason !== 'temporarily' && state.todayText && (
          <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
            {t('closed.todayHours', { hours: state.todayText })}
          </p>
        )}

        <p className="mt-1 text-xs" style={{ color: 'var(--faint)' }}>
          {t('closed.cartKept')}
        </p>

        <button className="btn-primary mt-6 w-full py-3.5" onClick={onClose}>
          {t('closed.ok')}
        </button>
      </div>
    </div>
  )
}
