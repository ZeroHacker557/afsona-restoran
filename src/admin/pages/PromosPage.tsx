import { useState } from 'react'
import { Copy, Pencil, Plus, Ticket, Trash2 } from 'lucide-react'
import { useAdminData } from '../lib/data-context'
import { createPromo, deletePromo, updatePromo, type AdminPromo } from '../lib/db'
import { Modal } from '../components/Modal'
import { Chip, ConfirmBar, Empty, Field, Spinner, Switch } from '../components/ui'
import { toast, toastError } from '../lib/toast'
import { money } from '../lib/format'

export function PromosPage() {
  const { promos } = useAdminData()
  const [editing, setEditing] = useState<AdminPromo | 'new' | null>(null)
  const [removing, setRemoving] = useState<AdminPromo | null>(null)
  const [busy, setBusy] = useState(false)

  async function toggleActive(promo: AdminPromo) {
    try {
      await updatePromo(promo.id, { active: !promo.active })
    } catch (error) {
      toastError(error)
    }
  }

  async function remove() {
    if (!removing) return
    setBusy(true)
    try {
      await deletePromo(removing.id)
      toast("Promokod o'chirildi")
      setRemoving(null)
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Promokod buyurtma sahifasida qo'llanadi. Chegirma taomlar summasidan hisoblanadi.
        </p>
        <button className="adm-btn primary" onClick={() => setEditing('new')}>
          <Plus size={17} />
          Promokod qo'shish
        </button>
      </div>

      {promos.length === 0 ? (
        <div className="adm-card">
          <Empty text="Hali promokod yo'q" icon={<Ticket size={30} strokeWidth={1.6} />} />
        </div>
      ) : (
        <div className="adm-card adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Chegirma</th>
                <th>Shartlar</th>
                <th>Ishlatilgan</th>
                <th>Holat</th>
                <th style={{ width: 110 }} />
              </tr>
            </thead>
            <tbody>
              {promos.map((promo) => (
                <tr key={promo.id}>
                  <td>
                    <button
                      className="flex items-center gap-2 font-extrabold"
                      onClick={() => {
                        navigator.clipboard?.writeText(promo.code)
                        toast('Kod nusxalandi')
                      }}
                      title="Nusxalash"
                    >
                      {promo.code}
                      <Copy size={13} style={{ color: 'var(--faint)' }} />
                    </button>
                  </td>
                  <td className="font-bold">{promo.discountPercent}%</td>
                  <td className="text-xs" style={{ color: 'var(--muted)' }}>
                    {describe(promo)}
                  </td>
                  <td>
                    {promo.usageCount}
                    {promo.maxUses ? ` / ${promo.maxUses}` : ''}
                  </td>
                  <td>
                    <button onClick={() => toggleActive(promo)}>
                      <Chip
                        color={promo.active ? 'var(--success)' : 'var(--muted)'}
                        background={promo.active ? 'var(--success-soft)' : 'var(--surface-3)'}
                      >
                        {promo.active ? 'Faol' : "O'chirilgan"}
                      </Chip>
                    </button>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="adm-icon-btn" onClick={() => setEditing(promo)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        className="adm-icon-btn"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => setRemoving(promo)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {removing && (
        <Modal title="Promokodni o'chirish" onClose={() => setRemoving(null)}>
          <ConfirmBar
            text={`"${removing.code}" o'chiriladi.`}
            onCancel={() => setRemoving(null)}
            onConfirm={remove}
            busy={busy}
          />
        </Modal>
      )}

      {editing && (
        <PromoModal promo={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}

function describe(promo: AdminPromo): string {
  const parts: string[] = []
  if (promo.minOrderTotal) parts.push(`min ${money(promo.minOrderTotal)}`)
  if (promo.firstOrderOnly) parts.push('faqat 1-buyurtma')
  if (promo.expiresAt) {
    const date = new Date(promo.expiresAt)
    const expired = date.getTime() < Date.now()
    parts.push(`${expired ? 'muddati tugagan' : 'amal qiladi'}: ${date.toLocaleDateString('ru-RU')}`)
  }
  return parts.length ? parts.join(' · ') : 'Cheklovsiz'
}

function PromoModal({ promo, onClose }: { promo: AdminPromo | null; onClose: () => void }) {
  const [code, setCode] = useState(promo?.code || '')
  const [percent, setPercent] = useState(promo ? String(promo.discountPercent) : '10')
  const [minOrder, setMinOrder] = useState(promo?.minOrderTotal ? String(promo.minOrderTotal) : '')
  const [maxUses, setMaxUses] = useState(promo?.maxUses ? String(promo.maxUses) : '')
  const [expires, setExpires] = useState(promo?.expiresAt ? promo.expiresAt.slice(0, 10) : '')
  const [firstOnly, setFirstOnly] = useState(promo?.firstOrderOnly === true)
  const [active, setActive] = useState(promo ? promo.active : true)
  const [busy, setBusy] = useState(false)

  async function save() {
    const cleanCode = code.trim().toUpperCase()
    const discount = Number(percent)

    if (!/^[A-Z0-9_-]{3,20}$/.test(cleanCode)) {
      return toast('Kod 3–20 ta belgi: harf, raqam, _ yoki -', 'error')
    }
    if (!Number.isFinite(discount) || discount < 1 || discount > 100) {
      return toast('Chegirma 1–100% oralig‘ida', 'error')
    }

    setBusy(true)
    try {
      const payload = {
        code: cleanCode,
        discountPercent: Math.round(discount),
        active,
        // Kun oxirigacha amal qiladi
        expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
        minOrderTotal: minOrder ? Math.round(Number(minOrder)) : 0,
        maxUses: maxUses ? Math.round(Number(maxUses)) : 0,
        firstOrderOnly: firstOnly,
      }

      if (promo) {
        await updatePromo(promo.id, payload)
        toast('Promokod yangilandi')
      } else {
        await createPromo(payload)
        toast("Promokod qo'shildi")
      }
      onClose()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={promo ? 'Promokodni tahrirlash' : 'Yangi promokod'}
      onClose={onClose}
      footer={
        <>
          <button className="adm-btn" onClick={onClose} disabled={busy}>
            Bekor
          </button>
          <button className="adm-btn primary" onClick={save} disabled={busy}>
            {busy ? <Spinner /> : null}
            Saqlash
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kod">
          <input
            className="adm-input uppercase"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="AFSONA10"
            autoFocus
          />
        </Field>

        <Field label="Chegirma (%)">
          <input
            className="adm-input"
            inputMode="numeric"
            value={percent}
            onChange={(event) => setPercent(event.target.value.replace(/\D/g, ''))}
          />
        </Field>

        <Field label="Minimal buyurtma (so'm)" hint="Bo'sh — cheklov yo'q">
          <input
            className="adm-input"
            inputMode="numeric"
            value={minOrder}
            onChange={(event) => setMinOrder(event.target.value.replace(/\D/g, ''))}
          />
        </Field>

        <Field label="Necha marta ishlatiladi" hint="Bo'sh — cheksiz">
          <input
            className="adm-input"
            inputMode="numeric"
            value={maxUses}
            onChange={(event) => setMaxUses(event.target.value.replace(/\D/g, ''))}
          />
        </Field>

        <Field label="Amal qilish muddati" hint="Bo'sh — muddatsiz">
          <input
            className="adm-input"
            type="date"
            value={expires}
            onChange={(event) => setExpires(event.target.value)}
          />
        </Field>
      </div>

      <Switch
        checked={firstOnly}
        onChange={setFirstOnly}
        label="Faqat birinchi buyurtma uchun"
        hint="Ilgari buyurtma bergan mijoz bu kodni ishlata olmaydi"
      />

      <Switch checked={active} onChange={setActive} label="Faol" />

      <p className="adm-hint">
        Har bir mijoz bitta promokodni faqat bir marta ishlatishi mumkin — bu doim amal qiladi.
      </p>
    </Modal>
  )
}
