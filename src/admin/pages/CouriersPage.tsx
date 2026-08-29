import { useEffect, useState } from 'react'
import { Bike, Copy, Plus, Trash2, Users } from 'lucide-react'
import { Modal } from '../components/Modal'
import { ConfirmBar, Empty, Field, Spinner, Switch } from '../components/ui'
import { readCouriers, saveSetting, watchSetting, type CourierSettings } from '../lib/db'
import { toast, toastError } from '../lib/toast'

/**
 * Kuryerlar bo'limi.
 *
 * Bu yerda faqat ro'yxat boshqariladi — buyurtma kelganda kimga
 * yuborilishini shu ro'yxat hal qiladi. Tugmalarni ham faqat shu
 * ro'yxatdagi odamlar bosa oladi: guruhda begona odam bosса,
 * unga "bu tugma faqat kuryer uchun" deb chiqadi.
 */

const MODE_LABEL: Record<CourierSettings['mode'], string> = {
  both: 'Kuryerlarga ham, guruhga ham',
  private: 'Faqat kuryerlarga shaxsan',
  group: 'Faqat guruhga',
}

export function CouriersPage() {
  const [settings, setSettings] = useState<CourierSettings | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)

  useEffect(() => watchSetting('couriers', readCouriers, setSettings), [])

  async function save(next: Partial<CourierSettings>) {
    try {
      await saveSetting('couriers', next as Record<string, unknown>)
    } catch (error) {
      toastError(error)
    }
  }

  if (!settings) return <Spinner center />

  const list = settings.list

  async function addCourier(id: number, name: string, phone: string) {
    if (list.some((item) => item.id === id)) {
      toastError(new Error('Bu Telegram ID ro‘yxatda bor'))
      return
    }
    await save({ list: [...list, { id, name, phone, active: true }] })
    toast('Kuryer qo‘shildi')
    setAdding(false)
  }

  async function removeCourier(id: number) {
    await save({ list: list.filter((item) => item.id !== id) })
    setRemoving(null)
    toast('Kuryer o‘chirildi')
  }

  async function toggleCourier(id: number, active: boolean) {
    await save({ list: list.map((item) => (item.id === id ? { ...item, active } : item)) })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Ro'yxat ──────────────────────────────────── */}
      <div className="adm-card">
        <div className="adm-card-head">
          <span>Kuryerlar</span>
          <button className="adm-btn sm primary" onClick={() => setAdding(true)}>
            <Plus size={15} />
            Kuryer qo'shish
          </button>
        </div>

        <p className="px-4 pt-3 text-sm" style={{ color: 'var(--muted)' }}>
          Yangi buyurtma shu ro'yxatdagi kuryerlarga tugmalari bilan yuboriladi.
          Buyurtmani birinchi bo'lib «Oldim» bosgan kuryer oladi — qolganlarida
          tugma o'chadi.
        </p>

        {list.length === 0 ? (
          <div className="p-4">
            <Empty text="Hozircha kuryer qo'shilmagan" icon={<Bike size={26} />} />
          </div>
        ) : (
          <div className="flex flex-col">
            {list.map((courier) => (
              <div
                key={courier.id}
                className="flex flex-wrap items-center gap-3 border-t px-4 py-3"
                style={{ borderColor: 'var(--line-soft)' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{courier.name || 'Ismsiz'}</span>
                    {courier.active === false && (
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        · faol emas
                      </span>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    ID {courier.id}
                    {courier.phone ? ` · ${courier.phone}` : ''}
                  </div>
                </div>

                <div style={{ width: 150 }}>
                  <Switch
                    checked={courier.active !== false}
                    onChange={(value) => toggleCourier(courier.id, value)}
                    label={courier.active !== false ? 'Faol' : 'To‘xtatilgan'}
                  />
                </div>

                <button
                  className="adm-icon-btn"
                  onClick={() => setRemoving(courier.id)}
                  aria-label="O'chirish"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {removing !== null && (
          <div className="p-4">
            <ConfirmBar
              text="Kuryer ro'yxatdan o'chiriladi. Davom etamizmi?"
              onCancel={() => setRemoving(null)}
              onConfirm={() => removeCourier(removing)}
            />
          </div>
        )}
      </div>

      {/* ── Guruh ────────────────────────────────────── */}
      <div className="adm-card adm-card-pad">
        <div className="mb-3 flex items-center gap-2 font-bold">
          <Users size={17} />
          Xodimlar guruhi
        </div>

        {settings.groupChatId ? (
          <>
            <p className="text-sm">
              Biriktirilgan: <b>{settings.groupTitle || 'Guruh'}</b>
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              ID {settings.groupChatId}
            </p>
            <button
              className="adm-btn sm mt-3"
              onClick={async () => {
                await save({ groupChatId: null, groupTitle: '' })
                toast('Guruh uzildi')
              }}
            >
              Guruhni uzish
            </button>
          </>
        ) : (
          <ol
            className="ml-4 flex list-decimal flex-col gap-2 text-sm"
            style={{ color: 'var(--ink-2)' }}
          >
            <li>Telegramda xodimlar guruhini oching</li>
            <li>Botni guruhga a'zo qilib qo'shing</li>
            <li>
              Guruhda <code className="adm-code">/guruh</code> deb yozing — buni{' '}
              <b>administrator</b> yozishi kerak
            </li>
          </ol>
        )}
      </div>

      {/* ── Qayerga yuborilsin ───────────────────────── */}
      <div className="adm-card adm-card-pad">
        <div className="mb-3 font-bold">Buyurtma qayerga yuborilsin</div>
        <div className="flex flex-wrap gap-2">
          {(['both', 'private', 'group'] as const).map((mode) => (
            <button
              key={mode}
              className={`adm-btn sm ${settings.mode === mode ? 'primary' : ''}`}
              onClick={() => save({ mode })}
            >
              {MODE_LABEL[mode]}
            </button>
          ))}
        </div>
        {settings.mode !== 'private' && !settings.groupChatId && (
          <p className="mt-3 text-xs" style={{ color: 'var(--warning)' }}>
            Guruh hali biriktirilmagan — hozircha faqat kuryerlarning shaxsiy
            chatiga yuboriladi.
          </p>
        )}
      </div>

      {adding && <AddCourierModal onClose={() => setAdding(false)} onAdd={addCourier} />}
    </div>
  )
}

function AddCourierModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (id: number, name: string, phone: string) => Promise<void>
}) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const numeric = Number(id.trim())
    if (!Number.isFinite(numeric) || numeric === 0) {
      toastError(new Error('Telegram ID faqat raqamlardan iborat'))
      return
    }
    if (!name.trim()) {
      toastError(new Error('Ismni kiriting'))
      return
    }

    setBusy(true)
    try {
      await onAdd(numeric, name.trim(), phone.trim())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Yangi kuryer"
      onClose={onClose}
      footer={
        <>
          <button className="adm-btn" onClick={onClose}>
            Bekor
          </button>
          <button className="adm-btn primary" onClick={submit} disabled={busy}>
            {busy ? <Spinner /> : 'Saqlash'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Telegram ID"
          hint="Kuryer @userinfobot ga yozsa, bot unga o'z ID raqamini aytadi"
        >
          <input
            className="adm-input"
            inputMode="numeric"
            value={id}
            onChange={(event) => setId(event.target.value)}
            placeholder="123456789"
          />
        </Field>

        <Field label="Ismi">
          <input
            className="adm-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Aliboy"
          />
        </Field>

        <Field label="Telefon" hint="Ixtiyoriy — panelda ko'rinadi">
          <input
            className="adm-input"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+998 90 123 45 67"
          />
        </Field>

        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          <Copy size={12} className="mr-1 inline" />
          Kuryer botni bir marta ochib <code className="adm-code">/start</code> bosishi
          kerak — aks holda Telegram unga xabar yubora olmaydi.
        </p>
      </div>
    </Modal>
  )
}
