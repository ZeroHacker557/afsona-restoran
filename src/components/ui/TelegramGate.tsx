import { ShoppingBag } from 'lucide-react'

const BOT_URL = 'https://t.me/ecommercy_test_bot'

/**
 * Ilova Telegram tashqarisida ochilganda ko'rsatiladi.
 * Bu yerda hech qanday Firestore so'rovi yuborilmaydi — soxta
 * foydalanuvchilar baza'ga yozilmasligi uchun (F-06).
 */
export function TelegramGate() {
  return (
    <main className="grid min-h-[100dvh] place-items-center px-6" style={{ background: '#f4f3f8' }}>
      <div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center shadow-sm">
        <span
          className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-violet-700 shadow-lg shadow-violet-200"
          style={{ color: '#fff' }}
        >
          <ShoppingBag size={30} />
        </span>

        <h1 className="mt-6 text-2xl font-extrabold" style={{ color: '#111426' }}>
          Shop<span style={{ color: '#7c3aed' }}>Online</span>
        </h1>

        <p className="mt-3 text-sm leading-relaxed" style={{ color: '#64748b' }}>
          Do'kon Telegram ilovasi ichida ishlaydi. Xarid qilish uchun botni oching
          va <b>«🛍 Katalogni ochish»</b> tugmasini bosing.
        </p>

        <a
          href={BOT_URL}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold transition hover:-translate-y-0.5 active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #6d28d9, #7c3aed)',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(109, 40, 217, 0.25)',
          }}
        >
          Telegram'da ochish
        </a>
      </div>
    </main>
  )
}
