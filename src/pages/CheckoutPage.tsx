import { useEffect, useState } from 'react'
import { ArrowLeft, Copy, Check, MapPin, MessageSquare, Phone, Send, ShoppingBag, User, CreditCard, Banknote, Tag, Loader2 } from 'lucide-react'
import { formatPrice } from '../data'
import { getImageUrl, hapticFeedback } from '../utils/telegram'
import { db, getPaymentSettings } from '../lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import type { OrderForm, PaymentSettings, Product, PromoCode } from '../types/domain'
import L from 'leaflet'

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

type Props = {
  profile: import('../types/domain').UserProfile | null
  cartProducts: { product: Product; quantity: number; size?: string; color?: string; cartKey: string }[]
  cartTotal: number
  orderForm: OrderForm
  onUpdateForm: (field: keyof OrderForm, value: any) => void
  onSubmit: (finalTotal: number) => Promise<boolean>
  isSubmitting: boolean
  onBack: () => void
  onNavigate: (page: import('../types/domain').AppPage) => void
}

export function CheckoutPage({ profile, cartProducts, cartTotal, orderForm, onUpdateForm, onSubmit, isSubmitting, onBack, onNavigate }: Props) {
  const [copied, setCopied] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null)
  const [promoError, setPromoError] = useState('')
  const [payment, setPayment] = useState<PaymentSettings | null>(null)
  const addresses = profile?.addresses || []

  // Karta ma'lumoti yagona manbadan — settings/payment (F-07)
  useEffect(() => {
    let alive = true
    getPaymentSettings().then((settings) => {
      if (alive) setPayment(settings)
    })
    return () => { alive = false }
  }, [])

  const finalTotal = appliedPromo ? cartTotal * (1 - appliedPromo.discountPercent / 100) : cartTotal

  // Avtomatik to'ldirish
  if (!orderForm.name && profile?.first_name) {
    onUpdateForm('name', profile.first_name + (profile.last_name ? ' ' + profile.last_name : ''))
  }
  if (!orderForm.phone && profile?.phone) {
    onUpdateForm('phone', profile.phone)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return
    setPromoLoading(true)
    setPromoError('')
    try {
      const q = query(collection(db, 'promocodes'), where('code', '==', promoInput.trim().toUpperCase()), where('active', '==', true))
      const snap = await getDocs(q)
      if (snap.empty) {
        setPromoError('Noto\'g\'ri yoki muddati o\'tgan kod')
        setAppliedPromo(null)
      } else {
        const promoData = { id: snap.docs[0].id, ...snap.docs[0].data() } as PromoCode
        setAppliedPromo(promoData)
        setPromoError('')
        onUpdateForm('promoCode', promoData.code) // Custom logic to save promo code if needed
      }
    } catch {
      setPromoError('Xatolik yuz berdi')
    }
    setPromoLoading(false)
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
    await onSubmit(finalTotal)
  }

  const isValid = Boolean(orderForm.name.trim() && orderForm.phone.trim() && orderForm.address.trim())
  const canSubmit = isValid && !isSubmitting

  return (
    <>
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-8 sm:px-10 page-animate">
        <button
          onClick={onBack}
          className="grid size-11 place-items-center rounded-2xl transition hover:bg-violet-50 active:scale-90"
          style={{ color: '#111426' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-extrabold" style={{ color: '#111426' }}>Buyurtma berish</h1>
      </header>

      <div className="px-5 pb-10 pt-6 sm:px-10 page-animate">
        {/* Order Summary */}
        <section
          className="rounded-2xl border p-4"
          style={{ borderColor: '#f1f5f9', animation: 'fadeInUp 0.4s ease' }}
        >
          <h3 className="font-bold" style={{ color: '#111426' }}>
            <ShoppingBag size={18} className="mr-2 inline" style={{ color: '#7c3aed' }} />
            Buyurtma ({cartProducts.length} ta mahsulot)
          </h3>
          <div className="mt-3 space-y-3">
            {cartProducts.map(({ product, quantity, size, color, cartKey }) => (
              <div key={cartKey || product.id} className="flex items-center gap-3">
                <img
                  src={product.images[0] ? getImageUrl(product.images[0]) : ''}
                  alt={product.name}
                  className="size-14 rounded-xl border border-slate-100 object-contain p-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold" style={{ color: '#111426' }}>{product.name}</p>
                  {(size || color) && (
                    <p className="mt-0.5 text-[11px] font-medium" style={{ color: '#64748b' }}>
                      {size && size} {size && color && ' | '} {color && color}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs" style={{ color: '#64748b' }}>{quantity} × {formatPrice(product.price)}</p>
                </div>
                <b className="text-sm" style={{ color: '#111426' }}>{formatPrice(product.price * quantity)}</b>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t pt-3" style={{ borderColor: '#f1f5f9' }}>
            {/* Promo Code Input */}
            <div className="mb-3 flex items-start gap-2">
              <div className="flex-1">
                <div className="flex h-11 items-center gap-2 rounded-xl border px-3 transition-all focus-within:border-violet-300 focus-within:shadow-md focus-within:shadow-violet-100" style={{ borderColor: appliedPromo ? '#10b981' : promoError ? '#ef4444' : '#e2e8f0', background: '#fafafa' }}>
                  <Tag size={16} style={{ color: appliedPromo ? '#10b981' : '#94a3b8' }} />
                  <input
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); setAppliedPromo(null); }}
                    placeholder="Promokod (agar bo'lsa)"
                    className="h-full w-full bg-transparent text-sm font-bold outline-none"
                    style={{ color: appliedPromo ? '#10b981' : '#111426' }}
                    readOnly={!!appliedPromo}
                  />
                </div>
                {promoError && <p className="mt-1 pl-1 text-[10px] font-bold text-red-500">{promoError}</p>}
                {appliedPromo && <p className="mt-1 pl-1 text-[10px] font-bold text-emerald-500">Kiritildi: {appliedPromo.discountPercent}% chegirma!</p>}
              </div>
              {!appliedPromo ? (
                <button
                  onClick={handleApplyPromo}
                  disabled={!promoInput.trim() || promoLoading}
                  className="grid h-11 w-20 place-items-center rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#7c3aed' }}
                >
                  {promoLoading ? <Loader2 size={16} className="animate-spin" /> : 'Qo\'llash'}
                </button>
              ) : (
                <button
                  onClick={() => { setAppliedPromo(null); setPromoInput(''); }}
                  className="grid h-11 w-20 place-items-center rounded-xl text-sm font-bold text-slate-500 transition hover:bg-slate-100 border border-slate-200"
                >
                  Bekor q.
                </button>
              )}
            </div>

            <div className="flex justify-between items-center">
              <span className="font-bold" style={{ color: '#111426' }}>Jami:</span>
              <div className="text-right">
                {appliedPromo && (
                  <b className="text-sm line-through block" style={{ color: '#94a3b8' }}>{formatPrice(cartTotal)}</b>
                )}
                <b className="text-lg" style={{ color: appliedPromo ? '#10b981' : '#7c3aed' }}>{formatPrice(finalTotal)}</b>
              </div>
            </div>
          </div>
        </section>

        {/* Order Form */}
        <section className="mt-6" style={{ animation: 'fadeInUp 0.4s ease 0.1s both' }}>
          <h3 className="mb-4 font-bold" style={{ color: '#111426' }}>Yetkazib berish ma'lumotlari</h3>
          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-sm font-bold" style={{ color: '#334155' }}>
                Ismingiz <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all focus-within:border-violet-300 focus-within:shadow-md focus-within:shadow-violet-100" style={{ borderColor: '#e2e8f0', background: '#fafafa' }}>
                <User size={20} style={{ color: '#94a3b8' }} className="shrink-0" />
                <input
                  value={orderForm.name}
                  onChange={(e) => onUpdateForm('name', e.target.value)}
                  placeholder="To'liq ismingizni kiriting"
                  className="h-6 w-full bg-transparent text-sm outline-none"
                  style={{ color: '#111426' }}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="mb-1.5 block text-sm font-bold" style={{ color: '#334155' }}>
                Telefon raqam <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all focus-within:border-violet-300 focus-within:shadow-md focus-within:shadow-violet-100" style={{ borderColor: '#e2e8f0', background: '#fafafa' }}>
                <Phone size={20} style={{ color: '#94a3b8' }} className="shrink-0" />
                <input
                  value={orderForm.phone}
                  onChange={(e) => onUpdateForm('phone', e.target.value)}
                  placeholder="+998 90 123 45 67"
                  type="tel"
                  className="h-6 w-full bg-transparent text-sm outline-none"
                  style={{ color: '#111426' }}
                />
              </div>
            </div>

            {/* Address Selector */}
            <div>
              <label className="mb-1.5 block text-sm font-bold" style={{ color: '#334155' }}>
                Yetkazish manzili <span style={{ color: '#ef4444' }}>*</span>
              </label>
              
              {addresses.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="mb-3 text-sm text-slate-500">Sizda hali saqlangan manzillar yo'q</p>
                  <button 
                    onClick={() => onNavigate('addresses')}
                    className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-bold text-purple-600 transition hover:bg-purple-100"
                  >
                    + Yangi manzil qo'shish
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {addresses.map(addr => {
                    const isSelected = orderForm.address === addr.address
                    return (
                      <div 
                        key={addr.id}
                        onClick={() => {
                          onUpdateForm('address', addr.address)
                          onUpdateForm('location', addr.location)
                          hapticFeedback('light')
                        }}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-all ${
                          isSelected 
                            ? 'border-purple-500 bg-purple-50 shadow-sm' 
                            : 'border-slate-200 bg-white hover:border-purple-300'
                        }`}
                      >
                        <div className={`grid size-10 shrink-0 place-items-center rounded-full ${isSelected ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                          <MapPin size={20} />
                        </div>
                        <div className="flex-1">
                          <p className={`font-bold ${isSelected ? 'text-purple-700' : 'text-slate-700'}`}>{addr.name}</p>
                          <p className="text-xs text-slate-500 truncate">{addr.address}</p>
                        </div>
                        {isSelected && <Check size={20} className="text-purple-600" />}
                      </div>
                    )
                  })}
                  <button 
                    onClick={() => onNavigate('addresses')}
                    className="mt-2 w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
                  >
                    + Boshqa manzil qo'shish
                  </button>
                </div>
              )}
            </div>

            {/* Comment */}
            <div>
              <label className="mb-1.5 block text-sm font-bold" style={{ color: '#334155' }}>
                Izoh (ixtiyoriy)
              </label>
              <div className="flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all focus-within:border-violet-300 focus-within:shadow-md focus-within:shadow-violet-100" style={{ borderColor: '#e2e8f0', background: '#fafafa' }}>
                <MessageSquare size={20} style={{ color: '#94a3b8' }} className="shrink-0 mt-0.5" />
                <textarea
                  value={orderForm.comment}
                  onChange={(e) => onUpdateForm('comment', e.target.value)}
                  placeholder="Qo'shimcha izoh..."
                  rows={3}
                  className="w-full resize-none bg-transparent text-sm outline-none"
                  style={{ color: '#111426' }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Payment Method ───────────────────────────── */}
        <section className="mt-6" style={{ animation: 'fadeInUp 0.4s ease 0.2s both' }}>
          <h3 className="mb-4 font-bold" style={{ color: '#111426' }}>To'lov usuli</h3>

          <div className="flex gap-3">
            {/* Naqd */}
            <button
              type="button"
              onClick={() => onUpdateForm('paymentMethod', 'Naqd')}
              className="flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 py-4 transition-all"
              style={{
                borderColor: orderForm.paymentMethod === 'Naqd' ? '#7c3aed' : '#e2e8f0',
                background: orderForm.paymentMethod === 'Naqd' ? '#f5f0ff' : '#fafafa',
              }}
            >
              <Banknote size={26} style={{ color: orderForm.paymentMethod === 'Naqd' ? '#7c3aed' : '#94a3b8' }} />
              <span className="text-sm font-bold" style={{ color: orderForm.paymentMethod === 'Naqd' ? '#7c3aed' : '#64748b' }}>💵 Naqd pul</span>
              <span className="text-xs" style={{ color: '#94a3b8' }}>Yetkazganda</span>
            </button>

            {/* Karta */}
            <button
              type="button"
              onClick={() => onUpdateForm('paymentMethod', 'Karta')}
              className="flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 py-4 transition-all"
              style={{
                borderColor: orderForm.paymentMethod === 'Karta' ? '#7c3aed' : '#e2e8f0',
                background: orderForm.paymentMethod === 'Karta' ? '#f5f0ff' : '#fafafa',
              }}
            >
              <CreditCard size={26} style={{ color: orderForm.paymentMethod === 'Karta' ? '#7c3aed' : '#94a3b8' }} />
              <span className="text-sm font-bold" style={{ color: orderForm.paymentMethod === 'Karta' ? '#7c3aed' : '#64748b' }}>💳 Karta</span>
              <span className="text-xs" style={{ color: '#94a3b8' }}>O'tkazma</span>
            </button>
          </div>

          {/* Karta tanlanganda yo'riqnoma */}
          {orderForm.paymentMethod === 'Karta' && (
            <div
              className="mt-4 rounded-2xl border-2 p-4"
              style={{ borderColor: '#7c3aed', background: '#f5f0ff', animation: 'fadeInUp 0.3s ease' }}
            >
              <p className="mb-3 text-sm font-bold" style={{ color: '#7c3aed' }}>💳 Karta ma'lumotlari:</p>

              <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: '#64748b' }}>Karta raqami</p>
                  {payment ? (
                    <>
                      <p className="font-mono text-sm font-bold" style={{ color: '#111426' }}>{payment.cardNumber}</p>
                      <p className="mt-0.5 truncate text-xs font-bold" style={{ color: '#64748b' }}>{payment.cardOwner}</p>
                    </>
                  ) : (
                    <p className="mt-1 h-4 w-40 animate-pulse rounded" style={{ background: '#e2e8f0' }} />
                  )}
                </div>
                <button
                  type="button"
                  disabled={!payment?.cardNumber}
                  onClick={() => payment && handleCopy(payment.cardNumber)}
                  className="grid size-9 shrink-0 place-items-center rounded-xl transition active:scale-90 disabled:opacity-40"
                  style={{ background: copied ? '#dcfce7' : '#f1f5f9', color: copied ? '#16a34a' : '#7c3aed' }}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-xl p-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <span className="text-base">📌</span>
                <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>
                  Formani to'ldirganingizdan so'ng, <b>bot orqali sizga xabar keladi.</b>{' '}
                  To'lov chekini (screenshot) botga yuboring.
                  Admin tekshirib, buyurtmangizni tasdiqlaydi.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold shadow-lg transition hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
          style={{
            background: canSubmit ? 'linear-gradient(135deg, #6d28d9, #7c3aed)' : '#d1d5db',
            color: '#fff',
            boxShadow: canSubmit ? '0 8px 24px rgba(109, 40, 217, 0.25)' : 'none',
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Yuborilmoqda...
            </>
          ) : (
            <>
              <Send size={20} />
              Buyurtma berish
            </>
          )}
        </button>

        <p className="mt-3 text-center text-xs" style={{ color: '#94a3b8' }}>
          Buyurtma berish tugmasini bosganingizda, sizning ma'lumotlaringiz sotuvchiga yuboriladi.
        </p>
      </div>
    </>
  )
}
