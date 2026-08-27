import { UtensilsCrossed } from 'lucide-react'
import { BRAND, BOT_URL } from '../../config/brand'


/**
 * Ilova Telegram tashqarisida ochilganda ko'rsatiladi.
 * Bu yerda hech qanday Firestore so'rovi yuborilmaydi (F-06).
 *
 * I18nProvider'dan tashqarida ishlashi mumkin, shuning uchun
 * matn ikkala tilda ham beriladi.
 */
export function TelegramGate() {
  return (
    <main className="grid min-h-[100dvh] place-items-center px-6" style={{ background: 'var(--bg)' }}>
      <div
        className="w-full max-w-sm rounded-[24px] p-8 text-center"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-md)' }}
      >
        <span
          className="mx-auto grid size-16 place-items-center rounded-2xl"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          <UtensilsCrossed size={30} />
        </span>

        <h1 className="mt-6 text-2xl font-extrabold" style={{ color: 'var(--ink)' }}>
          {BRAND.name}<span style={{ color: 'var(--brand)' }}> {BRAND.nameSuffix}</span>
        </h1>

        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Restoran Telegram ilovasi ichida ishlaydi. Botni oching va
          &laquo;Menyuni ochish&raquo; tugmasini bosing.
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--faint)' }}>
          Ресторан работает внутри Telegram. Откройте бота и нажмите
          &laquo;Открыть меню&raquo;.
        </p>

        <a href={BOT_URL} className="btn-primary mt-7 w-full py-4">
          Telegram
        </a>
      </div>
    </main>
  )
}
