import { useState } from 'react'
import { Clock, CreditCard, Save, Store, Truck } from 'lucide-react'
import { useAdminData } from '../lib/data-context'
import { saveSetting } from '../lib/db'
import { Field, Spinner, Switch } from '../components/ui'
import { toast, toastError } from '../lib/toast'
import { DAY_NAMES_UZ, getOpenState, type WorkingHours } from '../../utils/hours'
import { BRAND } from '../../config/brand'

export function SettingsPage() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <HoursCard />
      <div className="flex flex-col gap-4">
        <DeliveryCard />
        <PaymentCard />
      </div>
      <BrandCard />
    </div>
  )
}

// ── Ish vaqti ────────────────────────────────────────────────

function HoursCard() {
  const { hours } = useAdminData()
  // Tahrir boshlanmaguncha bazadagi qiymat ko'rsatiladi. Shu tufayli
  // boshqa admin o'zgartirsa darhol ko'rinadi, effekt ham kerak emas.
  const [edited, setEdited] = useState<WorkingHours | null>(null)
  const [busy, setBusy] = useState(false)

  const draft = edited ?? hours
  const state = getOpenState(draft)

  const setDraft = (next: WorkingHours) => setEdited(next)

  function setDay(index: number, patch: Partial<WorkingHours['days'][number]>) {
    setEdited({
      ...draft,
      days: draft.days.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    })
  }

  /** Bir kunning vaqtini qolgan kunlarga nusxalash. */
  function copyToAll(index: number) {
    const source = draft.days[index]
    setEdited({ ...draft, days: draft.days.map(() => ({ ...source })) })
  }

  async function save() {
    setBusy(true)
    try {
      await saveSetting('hours', draft as unknown as Record<string, unknown>)
      setEdited(null)
      toast('Ish vaqti saqlandi')
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <span className="flex items-center gap-2">
          <Clock size={17} /> Ish vaqti
        </span>
        <span
          className="adm-chip"
          style={
            state.open
              ? { background: 'var(--success-soft)', color: 'var(--success)' }
              : { background: 'var(--danger-soft)', color: 'var(--danger)' }
          }
        >
          {state.open ? 'Hozir ochiq' : 'Hozir yopiq'}
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <Switch
          checked={draft.enabled}
          onChange={(value) => setDraft({ ...draft, enabled: value })}
          label="Ish vaqtini tekshirish"
          hint="O'chirilsa restoran doim ochiq hisoblanadi"
        />

        <Switch
          checked={draft.temporarilyClosed}
          onChange={(value) => setDraft({ ...draft, temporarilyClosed: value })}
          label="Vaqtincha yopiq"
          hint="Ish vaqti bo'lsa ham buyurtma qabul qilinmaydi"
        />

        {draft.enabled && (
          <div className="flex flex-col gap-2">
            {draft.days.map((day, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <span className="w-24 flex-shrink-0 text-sm font-semibold">{DAY_NAMES_UZ[index]}</span>

                <button
                  className="adm-btn sm"
                  style={
                    day.closed
                      ? { background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'transparent' }
                      : undefined
                  }
                  onClick={() => setDay(index, { closed: !day.closed })}
                >
                  {day.closed ? 'Dam olish' : 'Ish kuni'}
                </button>

                {!day.closed && (
                  <>
                    <input
                      className="adm-input"
                      style={{ width: 110 }}
                      type="time"
                      value={day.open}
                      onChange={(event) => setDay(index, { open: event.target.value })}
                    />
                    <span style={{ color: 'var(--muted)' }}>—</span>
                    <input
                      className="adm-input"
                      style={{ width: 110 }}
                      type="time"
                      value={day.close}
                      onChange={(event) => setDay(index, { close: event.target.value })}
                    />
                  </>
                )}

                <button
                  className="adm-btn ghost sm ml-auto"
                  onClick={() => copyToAll(index)}
                  title="Shu vaqtni barcha kunlarga qo'llash"
                >
                  Hammaga
                </button>
              </div>
            ))}

            <p className="adm-hint">
              Yopilish vaqti ochilishdan kichik bo'lsa (masalan 18:00 — 02:00), smena tunda
              davom etadi.
            </p>
          </div>
        )}

        <Field label="Yopiq bo'lgandagi izoh" hint="Mijozga ko'rsatiladigan qo'shimcha matn">
          <input
            className="adm-input"
            value={draft.closedNote}
            onChange={(event) => setDraft({ ...draft, closedNote: event.target.value })}
            placeholder="Texnik tanaffus, 15:00 da ochamiz"
          />
        </Field>

        <button className="adm-btn primary" onClick={save} disabled={busy}>
          {busy ? <Spinner /> : <Save size={16} />}
          Saqlash
        </button>
      </div>
    </div>
  )
}

// ── Yetkazib berish ──────────────────────────────────────────

function DeliveryCard() {
  const { delivery } = useAdminData()
  const [edited, setEdited] = useState<{ fee: string; freeFrom: string; minOrder: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const form = edited ?? {
    fee: String(delivery.fee || ''),
    freeFrom: String(delivery.freeFrom || ''),
    minOrder: String(delivery.minOrder || ''),
  }
  const setFee = (value: string) => setEdited({ ...form, fee: value })
  const setFreeFrom = (value: string) => setEdited({ ...form, freeFrom: value })
  const setMinOrder = (value: string) => setEdited({ ...form, minOrder: value })

  async function save() {
    setBusy(true)
    try {
      await saveSetting('delivery', {
        fee: Number(form.fee) || 0,
        freeFrom: Number(form.freeFrom) || 0,
        minOrder: Number(form.minOrder) || 0,
      })
      setEdited(null)
      toast('Yetkazib berish sozlamalari saqlandi')
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <span className="flex items-center gap-2">
          <Truck size={17} /> Yetkazib berish
        </span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <Field label="Yetkazish narxi (so'm)">
          <input
            className="adm-input"
            inputMode="numeric"
            value={form.fee}
            onChange={(event) => setFee(event.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field label="Bepul yetkazish chegarasi" hint="0 — bepul yetkazish yo'q">
          <input
            className="adm-input"
            inputMode="numeric"
            value={form.freeFrom}
            onChange={(event) => setFreeFrom(event.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field label="Minimal buyurtma summasi" hint="0 — cheklov yo'q">
          <input
            className="adm-input"
            inputMode="numeric"
            value={form.minOrder}
            onChange={(event) => setMinOrder(event.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <button className="adm-btn primary" onClick={save} disabled={busy}>
          {busy ? <Spinner /> : <Save size={16} />}
          Saqlash
        </button>
      </div>
    </div>
  )
}

// ── To'lov ───────────────────────────────────────────────────

function PaymentCard() {
  const { payment } = useAdminData()
  const [edited, setEdited] = useState<{ cardNumber: string; cardOwner: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const form = edited ?? { cardNumber: payment.cardNumber, cardOwner: payment.cardOwner }
  const setCardNumber = (value: string) => setEdited({ ...form, cardNumber: value })
  const setCardOwner = (value: string) => setEdited({ ...form, cardOwner: value })

  async function save() {
    setBusy(true)
    try {
      await saveSetting('payment', {
        cardNumber: form.cardNumber.trim(),
        cardOwner: form.cardOwner.trim(),
      })
      setEdited(null)
      toast("To'lov ma'lumotlari saqlandi")
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <span className="flex items-center gap-2">
          <CreditCard size={17} /> Karta orqali to'lov
        </span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <Field label="Karta raqami">
          <input
            className="adm-input"
            value={form.cardNumber}
            onChange={(event) => setCardNumber(event.target.value)}
            placeholder="8600 0000 0000 0000"
          />
        </Field>
        <Field label="Karta egasi">
          <input
            className="adm-input"
            value={form.cardOwner}
            onChange={(event) => setCardOwner(event.target.value)}
            placeholder="ISM FAMILIYA"
          />
        </Field>
        <button className="adm-btn primary" onClick={save} disabled={busy}>
          {busy ? <Spinner /> : <Save size={16} />}
          Saqlash
        </button>
      </div>
    </div>
  )
}

// ── Brend va aloqa ───────────────────────────────────────────

function BrandCard() {
  const { brand } = useAdminData()
  const [edited, setEdited] = useState<Record<string, string> | null>(null)
  const [busy, setBusy] = useState(false)

  // Bazada bo'sh bo'lsa — config/brand.ts dagi zaxira qiymatlar
  const form = edited ?? {
    name: brand.name || BRAND.fullName,
    phone: brand.phone || BRAND.phone,
    telegram: brand.telegram || BRAND.telegram,
    email: brand.email || BRAND.email,
    address: brand.address || BRAND.address,
  }
  const setForm = (next: Record<string, string>) => setEdited(next)

  async function save() {
    setBusy(true)
    try {
      await saveSetting('brand', {
        ...form,
        telegram: form.telegram.replace(/^@/, ''),
      })
      setEdited(null)
      toast("Aloqa ma'lumotlari saqlandi")
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <span className="flex items-center gap-2">
          <Store size={17} /> Restoran va aloqa
        </span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Restoran nomi">
          <input
            className="adm-input"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Telefon">
          <input
            className="adm-input"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder="+998 90 123 45 67"
          />
        </Field>
        <Field label="Telegram" hint="@ belgisisiz">
          <input
            className="adm-input"
            value={form.telegram}
            onChange={(event) => setForm({ ...form, telegram: event.target.value })}
          />
        </Field>
        <Field label="Email">
          <input
            className="adm-input"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Manzil">
            <input
              className="adm-input"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              placeholder="Toshkent, ..."
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <button className="adm-btn primary" onClick={save} disabled={busy}>
            {busy ? <Spinner /> : <Save size={16} />}
            Saqlash
          </button>
          <p className="adm-hint">
            Bu ma'lumotlar mijoz ilovasidagi «Yordam» sahifasida ko'rinadi.
          </p>
        </div>
      </div>
    </div>
  )
}
