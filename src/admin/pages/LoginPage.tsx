import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { signIn } from '../lib/auth'
import { BRAND, LOGO } from '../../config/brand'
import { Field, Spinner } from '../components/ui'

/**
 * Panelga kirish oynasi.
 *
 * Muvaffaqiyatli kirishdan keyin bu yerda hech narsa qilinmaydi: sessiya
 * o'zgarishini AdminApp dagi `onAdminAuthChanged` tinglaydi va panelni
 * o'zi ochadi. (Ilgari bu yerdan ham holat o'zgartirilar edi — ikkisi
 * bir-birini bosib, panel "tekshirilmoqda" da qotib qolardi.)
 *
 * Hisob yaratish va parolni tiklash bu yerda emas: yangi adminlar
 * panelning "Adminlar" bo'limidan qo'shiladi, parol esa /api/admin ning
 * `seed` amali orqali (ADMIN_SETUP_KEY bilan) tiklanadi.
 */
export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(email, password)
      // Panelni AdminApp ochadi — shu yerda kutib turamiz
    } catch (problem) {
      setBusy(false)
      setError(problem instanceof Error ? problem.message : 'Kirishda xato')
    }
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center px-5" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[380px]">
        <div className="adm-card" style={{ padding: 26 }}>
          <div className="flex flex-col items-center gap-3 text-center">
            <img
              src={LOGO}
              alt={BRAND.fullName}
              className="object-cover"
              style={{ height: 56, width: 56, borderRadius: 16 }}
            />
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">
                {BRAND.name}
                <span style={{ color: 'var(--brand)' }}> {BRAND.nameSuffix}</span>
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                Boshqaruv paneli
              </p>
            </div>
          </div>

          <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
            <Field label="Email">
              <input
                className="adm-input"
                type="email"
                value={email}
                autoComplete="username"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@afsona.uz"
                required
              />
            </Field>

            <Field label="Parol">
              <div className="relative">
                <input
                  className="adm-input pr-11"
                  type={visible ? 'text' : 'password'}
                  value={password}
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="adm-icon-btn absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setVisible((value) => !value)}
                  aria-label="Parolni ko'rsatish"
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>

            {error && (
              <p
                className="rounded-[10px] px-3 py-2 text-sm font-semibold"
                style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
              >
                {error}
              </p>
            )}

            <button className="adm-btn primary w-full py-3" disabled={busy}>
              {busy ? <Spinner /> : <LogIn size={17} />}
              Kirish
            </button>
          </form>
        </div>

      </div>
    </main>
  )
}
