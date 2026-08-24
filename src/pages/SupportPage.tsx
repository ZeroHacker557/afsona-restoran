import {
  ChevronDown,
  ChevronUp,
  Mail,
  MessageCircle,
  Phone,
  ArrowLeft,
  Headphones,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { useState } from 'react'
import { useT } from '../i18n'

type Props = {
  onBack: () => void
}

const faqs_uz = [
  {
    q: "Buyurtmamni qanday kuzatib borish mumkin?",
    a: "Profil sahifasidagi «Buyurtmalar tarixi» bo'limiga o'ting. U yerda barcha buyurtmalaringizning holati real vaqtda ko'rinib turadi.",
  },
  {
    q: "To'lov qanday amalga oshiriladi?",
    a: "Naqd pul (yetkazishda) yoki karta orqali o'tkazma usulida to'lashingiz mumkin. Karta orqali to'lashda chekni botga yuboring — admin tasdiqlaydi.",
  },
  {
    q: "Mahsulotni qaytarish mumkinmi?",
    a: "Ha, mahsulotni olgan kundan boshlab 14 kun ichida qaytarish mumkin. Buning uchun biz bilan bog'laning.",
  },
  {
    q: "Yetkazib berish qancha vaqt oladi?",
    a: "Odatda 1–3 ish kuni. Buyurtma holati o'zgarganda siz avtomatik bildirishnoma olasiz.",
  },
  {
    q: "Promo kod qanday ishlatiladi?",
    a: "Buyurtma berish sahifasida «Promokod» maydoniga kodingizni kiriting va «Qo'llash» tugmasini bosing. Chegirma avtomatik qo'shiladi.",
  },
]

const faqs_ru = [
  {
    q: "Как отслеживать мой заказ?",
    a: "Перейдите в раздел «История заказов» в профиле. Там отображается статус всех ваших заказов в реальном времени.",
  },
  {
    q: "Как осуществляется оплата?",
    a: "Вы можете оплатить наличными при доставке или переводом на карту. При оплате картой отправьте чек боту — администратор подтвердит.",
  },
  {
    q: "Можно ли вернуть товар?",
    a: "Да, в течение 14 дней с момента получения. Для оформления возврата свяжитесь с нами.",
  },
  {
    q: "Сколько времени занимает доставка?",
    a: "Обычно 1–3 рабочих дня. При изменении статуса заказа вы получите уведомление.",
  },
  {
    q: "Как использовать промокод?",
    a: "На странице оформления заказа введите код в поле «Промокод» и нажмите «Применить». Скидка добавится автоматически.",
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition active:opacity-70"
      >
        <span className="font-semibold text-sm leading-snug" style={{ color: 'var(--ink)' }}>
          {q}
        </span>
        <span className="shrink-0" style={{ color: 'var(--brand)' }}>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>
      {open && (
        <div
          className="px-5 pb-4 text-sm leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          {a}
        </div>
      )}
    </div>
  )
}

export function SupportPage({ onBack }: Props) {
  const t = useT()
  // detect lang from localStorage
  const lang = (localStorage.getItem('shopOnlineLang') ?? 'uz') as 'uz' | 'ru'
  const faqs = lang === 'ru' ? faqs_ru : faqs_uz

  const contacts = [
    {
      id: 'phone',
      icon: Phone,
      label: lang === 'ru' ? 'Телефон' : 'Telefon',
      value: '+998 97 400 98 77',
      href: 'tel:+998974009877',
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.12)',
    },
    {
      id: 'telegram',
      icon: MessageCircle,
      label: 'Telegram',
      value: '@for_name',
      href: 'https://t.me/for_name',
      color: '#0ea5e9',
      bg: 'rgba(14,165,233,0.12)',
    },
    {
      id: 'email',
      icon: Mail,
      label: 'Gmail',
      value: 'abubakrdeveloper@gmail.com',
      href: 'mailto:abubakrdeveloper@gmail.com',
      color: 'var(--brand)',
      bg: 'var(--brand-soft)',
    },
  ]

  const features = lang === 'ru'
    ? [
        { icon: Clock, text: 'Поддержка 24/7' },
        { icon: CheckCircle2, text: 'Быстрый ответ' },
        { icon: Headphones, text: 'Профессиональная помощь' },
      ]
    : [
        { icon: Clock, text: '24/7 qo\'llab-quvvatlash' },
        { icon: CheckCircle2, text: 'Tez javob' },
        { icon: Headphones, text: 'Professional yordam' },
      ]

  return (
    <>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-5 pt-8 pb-5 sm:px-10"
        style={{ animation: 'fadeInUp 0.3s ease' }}
      >
        <button
          onClick={onBack}
          className="grid size-10 shrink-0 place-items-center rounded-xl transition active:scale-90"
          style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
          aria-label={t('common.back')}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold leading-tight" style={{ color: 'var(--ink)' }}>
            {lang === 'ru' ? 'Помощь и поддержка' : "Yordam va qo'llab-quvvatlash"}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {lang === 'ru' ? 'Мы всегда рядом' : "Biz doim siz bilan"}
          </p>
        </div>
      </header>

      {/* Hero Card */}
      <section className="px-5 sm:px-10" style={{ animation: 'fadeInUp 0.35s ease 0.05s both' }}>
        <div
          className="relative overflow-hidden rounded-3xl p-6"
          style={{
            background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%)',
          }}
        >
          {/* Decorative circles */}
          <div
            className="absolute -right-8 -top-8 size-32 rounded-full opacity-20"
            style={{ background: 'white' }}
          />
          <div
            className="absolute -bottom-6 right-10 size-20 rounded-full opacity-10"
            style={{ background: 'white' }}
          />

          <div className="relative z-10">
            <div
              className="inline-grid size-14 place-items-center rounded-2xl mb-4"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <Headphones size={28} color="white" />
            </div>
            <h2 className="text-xl font-extrabold text-white leading-tight">
              {lang === 'ru' ? 'Разработчик / Developer' : 'Dasturchi / Developer'}
            </h2>
            <p className="mt-1 text-sm text-white opacity-80">
              {lang === 'ru'
                ? 'Свяжитесь с нами любым удобным способом'
                : "Qulay usul orqali biz bilan bog'laning"}
            </p>

            {/* Feature badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              {features.map(({ icon: Icon, text }) => (
                <span
                  key={text}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}
                >
                  <Icon size={12} />
                  {text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Cards */}
      <section
        className="px-5 pt-6 sm:px-10"
        style={{ animation: 'fadeInUp 0.4s ease 0.1s both' }}
      >
        <h2 className="section-title mb-4">
          {lang === 'ru' ? 'Контакты' : "Bog'lanish"}
        </h2>
        <div className="flex flex-col gap-3">
          {contacts.map(({ id, icon: Icon, label, value, href, color, bg }) => (
            <a
              key={id}
              id={`support-contact-${id}`}
              href={href}
              target={id !== 'phone' ? '_blank' : undefined}
              rel="noreferrer"
              className="flex items-center gap-4 rounded-2xl border p-4 transition active:scale-[0.98] hover:opacity-90"
              style={{ borderColor: 'var(--line)', background: 'var(--surface)', textDecoration: 'none' }}
            >
              <span
                className="grid size-12 shrink-0 place-items-center rounded-2xl"
                style={{ background: bg, color }}
              >
                <Icon size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  {label}
                </p>
                <p className="mt-0.5 truncate font-bold text-sm" style={{ color: 'var(--ink)' }}>
                  {value}
                </p>
              </div>
              <span
                className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold"
                style={{ background: bg, color }}
              >
                {lang === 'ru' ? 'Написать' : 'Yozish'}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section
        className="px-5 pt-7 pb-32 sm:px-10"
        style={{ animation: 'fadeInUp 0.4s ease 0.15s both' }}
      >
        <h2 className="section-title mb-4">
          {lang === 'ru' ? 'Часто задаваемые вопросы' : "Ko'p so'raladigan savollar"}
        </h2>
        <div className="flex flex-col gap-3">
          {faqs.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>

        {/* Footer note */}
        <div
          className="mt-6 rounded-2xl border p-4 text-center"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            {lang === 'ru'
              ? 'Не нашли ответ? Напишите нам — мы ответим в течение нескольких минут.'
              : "Javob topa olmadingizmi? Bizga yozing — bir necha daqiqa ichida javob beramiz."}
          </p>
        </div>
      </section>
    </>
  )
}
