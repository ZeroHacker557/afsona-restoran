import { useCallback, useEffect, useState } from 'react'
import { Bell, KeyRound, Mail, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { adminPost } from '../lib/api'
import { Modal } from '../components/Modal'
import { Chip, ConfirmBar, Empty, Field, Spinner } from '../components/ui'
import { toast, toastError } from '../lib/toast'

type AdminsResponse = {
  owners: string[]
  emails: string[]
  telegramIds: number[]
}

export function AdminsPage() {
  const [data, setData] = useState<AdminsResponse | null>(null)
  const [adding, setAdding] = useState(false)
  const [changing, setChanging] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [telegramId, setTelegramId] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await adminPost<AdminsResponse>('admins.list'))
    } catch (error) {
      toastError(error)
    }
  }, [])

  // Ro'yxat serverdan keladi (custom claim'lar Firestore'da emas)
  useEffect(() => {
    let alive = true
    adminPost<AdminsResponse>('admins.list')
      .then((result) => {
        if (alive) setData(result)
      })
      .catch(toastError)
    return () => {
      alive = false
    }
  }, [])

  async function removeAdmin() {
    if (!removing) return
    setBusy(true)
    try {
      await adminPost('admins.remove', { email: removing })
      toast('Admin ro‘yxatdan chiqarildi')
      setRemoving(null)
      await load()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  async function addTelegram() {
    const id = Number(telegramId)
    if (!Number.isFinite(id) || id === 0) return toast('ID raqam bo‘lishi kerak', 'error')
    setBusy(true)
    try {
      await adminPost('admins.telegram', { mode: 'add', id })
      toast('Qo‘shildi — sinov xabari yuborildi')
      setTelegramId('')
      await load()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  async function removeTelegram(id: number) {
    try {
      await adminPost('admins.telegram', { mode: 'remove', id })
      await load()
    } catch (error) {
      toastError(error)
    }
  }

  if (!data) return <Spinner center />

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="adm-card">
        <div className="adm-card-head">
          <span className="flex items-center gap-2">
            <ShieldCheck size={17} /> Panelga kira oladiganlar
          </span>
          <button className="adm-btn primary sm" onClick={() => setAdding(true)}>
            <Plus size={15} />
            Admin qo'shish
          </button>
        </div>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <tbody>
              {data.emails.map((email) => {
                const owner = data.owners.includes(email)
                return (
                  <tr key={email}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span
                          className="grid size-9 place-items-center rounded-full"
                          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
                        >
                          <Mail size={16} />
                        </span>
                        <span className="font-semibold">{email}</span>
                        {owner && (
                          <Chip color="var(--info)" background="var(--info-soft)">
                            Egasi
                          </Chip>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          className="adm-icon-btn"
                          onClick={() => setChanging(email)}
                          title="Parolni o'zgartirish"
                        >
                          <KeyRound size={16} />
                        </button>
                        {!owner && (
                          <button
                            className="adm-icon-btn"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => setRemoving(email)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="adm-hint px-4 pb-4">
          «Egasi» — Vercel'dagi <b>ADMIN_EMAILS</b> ro'yxatidan kelgan hisob, uni paneldan
          o'chirib bo'lmaydi.
        </p>
      </div>

      <div className="adm-card">
        <div className="adm-card-head">
          <span className="flex items-center gap-2">
            <Bell size={17} /> Buyurtma xabarnomasi
          </span>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Yangi buyurtma tushganda quyidagi Telegram hisoblariga xabar yuboriladi. O'z ID'ingizni
            bilish uchun Telegram'da <b>@userinfobot</b> ga yozing.
          </p>

          {data.telegramIds.length === 0 ? (
            <Empty text="Hali hech kim qo'shilmagan" icon={<Bell size={26} strokeWidth={1.6} />} />
          ) : (
            <div className="flex flex-col gap-2">
              {data.telegramIds.map((id) => (
                <div
                  key={id}
                  className="flex items-center gap-3 rounded-[var(--r-sm)] p-2"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <span className="font-bold">{id}</span>
                  <button
                    className="adm-icon-btn ml-auto"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => removeTelegram(id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              className="adm-input"
              inputMode="numeric"
              placeholder="Telegram ID, masalan 7203124812"
              value={telegramId}
              onChange={(event) => setTelegramId(event.target.value.replace(/[^\d-]/g, ''))}
            />
            <button className="adm-btn primary" onClick={addTelegram} disabled={busy}>
              {busy ? <Spinner /> : <Plus size={16} />}
            </button>
          </div>
        </div>
      </div>

      {adding && (
        <AdminFormModal
          title="Yangi admin"
          onClose={() => setAdding(false)}
          onSubmit={async (email, password) => {
            await adminPost('admins.add', { email, password })
            toast("Admin qo'shildi")
            await load()
          }}
        />
      )}

      {changing && (
        <AdminFormModal
          title="Parolni o'zgartirish"
          fixedEmail={changing}
          onClose={() => setChanging(null)}
          onSubmit={async (email, password) => {
            await adminPost('admins.password', { email, password })
            toast("Parol o'zgartirildi")
          }}
        />
      )}

      {removing && (
        <Modal title="Adminni o'chirish" onClose={() => setRemoving(null)}>
          <ConfirmBar
            text={`${removing} panelga kira olmay qoladi.`}
            confirmText="Ha, o'chirilsin"
            onCancel={() => setRemoving(null)}
            onConfirm={removeAdmin}
            busy={busy}
          />
        </Modal>
      )}
    </div>
  )
}

function AdminFormModal({
  title,
  fixedEmail,
  onClose,
  onSubmit,
}: {
  title: string
  fixedEmail?: string
  onClose: () => void
  onSubmit: (email: string, password: string) => Promise<void>
}) {
  const [email, setEmail] = useState(fixedEmail || '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!email.includes('@')) return toast('Email noto‘g‘ri', 'error')
    if (password.length < 8) return toast('Parol kamida 8 belgi', 'error')
    setBusy(true)
    try {
      await onSubmit(email.trim().toLowerCase(), password)
      onClose()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="adm-btn" onClick={onClose} disabled={busy}>
            Bekor
          </button>
          <button className="adm-btn primary" onClick={submit} disabled={busy}>
            {busy ? <Spinner /> : null}
            Saqlash
          </button>
        </>
      }
    >
      <Field label="Email">
        <input
          className="adm-input"
          type="email"
          value={email}
          disabled={!!fixedEmail}
          onChange={(event) => setEmail(event.target.value)}
          autoFocus={!fixedEmail}
        />
      </Field>
      <Field label="Parol" hint="Kamida 8 belgi">
        <input
          className="adm-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus={!!fixedEmail}
        />
      </Field>
    </Modal>
  )
}
