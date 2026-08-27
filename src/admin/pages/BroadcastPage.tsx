import { useRef, useState } from 'react'
import { Image as ImageIcon, Send, Users, X } from 'lucide-react'
import { adminPost } from '../lib/api'
import { uploadBroadcastMedia } from '../lib/upload'
import { Field, Spinner, Switch } from '../components/ui'
import { toast, toastError } from '../lib/toast'
import { useAdminData } from '../lib/data-context'

/** Bir so'rovda yuboriladigan xabarlar soni — server bilan bir xil. */
const BATCH = 25

const SEGMENTS = [
  { id: 'all', label: 'Hamma mijozlar', hint: 'Ilovaga kirgan barcha foydalanuvchilar' },
  { id: 'buyers', label: 'Buyurtma qilganlar', hint: 'Kamida bitta buyurtma bergan' },
  { id: 'nonbuyers', label: 'Hali buyurtma qilmaganlar', hint: 'Ilovani ochgan, lekin buyurtma bermagan' },
  { id: 'active7', label: 'Faol (7 kun)', hint: 'Oxirgi hafta ichida ilovaga kirgan' },
  { id: 'inactive30', label: 'Uzoq kirmaganlar', hint: '30 kundan beri ilovaga kirmagan' },
] as const

type Progress = { total: number; sent: number; blocked: number; failed: number } | null

export function BroadcastPage() {
  const { users } = useAdminData()
  const fileInput = useRef<HTMLInputElement>(null)

  const [segment, setSegment] = useState<string>('all')
  const [text, setText] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaKind, setMediaKind] = useState<'photo' | 'video'>('photo')
  const [buttonText, setButtonText] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [saveInApp, setSaveInApp] = useState(true)
  const [title, setTitle] = useState('📢 Yangilik')

  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState<Progress>(null)

  async function pickMedia(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadBroadcastMedia(file)
      setMediaUrl(url)
      setMediaKind(file.type.startsWith('video/') ? 'video' : 'photo')
      toast('Fayl yuklandi')
    } catch (error) {
      toastError(error)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function send() {
    if (!text.trim() && !mediaUrl) return toast('Xabar matnini yozing', 'error')

    setSending(true)
    setProgress(null)
    try {
      const { ids } = await adminPost<{ ids: number[] }>('broadcast.recipients', { segment })
      if (!ids.length) {
        toast('Bu segmentda mijoz topilmadi', 'error')
        return
      }

      let sent = 0
      let blocked = 0
      let failed = 0
      setProgress({ total: ids.length, sent, blocked, failed })

      // Paketlab yuboramiz: bitta funksiya chaqiruvi vaqt chegarasiga
      // tushmasin va progress jonli ko'rinsin
      for (let index = 0; index < ids.length; index += BATCH) {
        const chunk = ids.slice(index, index + BATCH)
        const result = await adminPost<{ sent: number; blocked: number; failed: number[] }>(
          'broadcast.send',
          {
            chatIds: chunk,
            text: text.trim(),
            photoUrl: mediaKind === 'photo' ? mediaUrl || undefined : undefined,
            videoUrl: mediaKind === 'video' ? mediaUrl || undefined : undefined,
            buttonText: buttonText.trim() || undefined,
            buttonUrl: buttonUrl.trim() || undefined,
            saveInApp,
            title,
          },
        )
        sent += result.sent
        blocked += result.blocked
        failed += result.failed.length
        setProgress({ total: ids.length, sent, blocked, failed })
      }

      toast(`Yuborildi: ${sent} ta. Bloklagan: ${blocked} ta`)
    } catch (error) {
      toastError(error)
    } finally {
      setSending(false)
    }
  }

  const percent = progress ? Math.round(((progress.sent + progress.blocked + progress.failed) / progress.total) * 100) : 0

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="adm-card adm-card-pad flex flex-col gap-4">
          <div>
            <span className="adm-label">Kimga yuboriladi</span>
            <div className="flex flex-col gap-2">
              {SEGMENTS.map((item) => (
                <button
                  key={item.id}
                  className="flex items-start gap-3 rounded-[var(--r-sm)] border p-3 text-left"
                  style={{
                    borderColor: segment === item.id ? 'var(--brand)' : 'var(--line)',
                    background: segment === item.id ? 'var(--brand-soft)' : 'var(--surface-2)',
                  }}
                  onClick={() => setSegment(item.id)}
                >
                  <span
                    className="mt-0.5 size-4 flex-shrink-0 rounded-full border-[5px]"
                    style={{
                      borderColor: segment === item.id ? 'var(--brand)' : 'var(--line)',
                      background: 'var(--surface)',
                    }}
                  />
                  <span>
                    <span className="block text-sm font-bold">{item.label}</span>
                    <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                      {item.hint}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Field label="Xabar matni" hint="HTML: <b>qalin</b>, <i>qiya</i>, <a href='...'>havola</a>">
            <textarea
              className="adm-textarea"
              style={{ minHeight: 150 }}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="🔥 Bugun barcha taomlarga 20% chegirma!"
            />
          </Field>

          <div>
            <span className="adm-label">Rasm yoki video</span>
            {mediaUrl ? (
              <div className="relative inline-block">
                {mediaKind === 'video' ? (
                  <video src={mediaUrl} className="max-h-48 rounded-[var(--r-sm)]" controls />
                ) : (
                  <img src={mediaUrl} alt="" className="max-h-48 rounded-[var(--r-sm)]" />
                )}
                <button
                  className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full"
                  style={{ background: 'var(--danger)', color: '#fff' }}
                  onClick={() => setMediaUrl('')}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                className="adm-btn"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Spinner /> : <ImageIcon size={16} />}
                Fayl tanlash
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/mp4"
              hidden
              onChange={(event) => pickMedia(event.target.files?.[0])}
            />
            <p className="adm-hint">Video 45 MB gacha. Telegram faylni havola orqali oladi.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tugma matni" hint="Bo'sh qoldirilsa — 'Ilovani ochish'">
              <input
                className="adm-input"
                value={buttonText}
                onChange={(event) => setButtonText(event.target.value)}
                placeholder="Menyuni ko'rish"
              />
            </Field>
            <Field label="Tugma havolasi">
              <input
                className="adm-input"
                value={buttonUrl}
                onChange={(event) => setButtonUrl(event.target.value)}
                placeholder="https://…"
              />
            </Field>
          </div>

          <Switch
            checked={saveInApp}
            onChange={setSaveInApp}
            label="Ilova ichida ham ko'rinsin"
            hint="Xabar 'Bildirishnomalar' bo'limida saqlanadi"
          />

          {saveInApp && (
            <Field label="Bildirishnoma sarlavhasi">
              <input
                className="adm-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
          )}

          <button className="adm-btn primary py-3" onClick={send} disabled={sending || uploading}>
            {sending ? <Spinner /> : <Send size={17} />}
            Yuborish
          </button>

          {progress && (
            <div className="flex flex-col gap-2">
              <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${percent}%`, background: 'var(--brand)' }}
                />
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                <span>Jami: {progress.total}</span>
                <span style={{ color: 'var(--success)' }}>Yuborildi: {progress.sent}</span>
                <span style={{ color: 'var(--warning)' }}>Bloklagan: {progress.blocked}</span>
                {progress.failed > 0 && (
                  <span style={{ color: 'var(--danger)' }}>Xato: {progress.failed}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ko'rinishi */}
      <div className="flex flex-col gap-4">
        <div className="adm-card">
          <div className="adm-card-head">
            <span>Ko'rinishi</span>
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
              <Users size={13} />
              {users.length} mijoz
            </span>
          </div>
          <div className="p-4">
            <div
              className="rounded-[var(--r-md)] p-3"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
            >
              {mediaUrl &&
                (mediaKind === 'video' ? (
                  <video src={mediaUrl} className="mb-2 w-full rounded-[var(--r-sm)]" />
                ) : (
                  <img src={mediaUrl} alt="" className="mb-2 w-full rounded-[var(--r-sm)]" />
                ))}
              <div
                className="whitespace-pre-wrap text-sm"
                dangerouslySetInnerHTML={{ __html: text || '<i style="opacity:.5">Xabar matni…</i>' }}
              />
              <div
                className="mt-3 rounded-[var(--r-sm)] py-2 text-center text-sm font-semibold"
                style={{ background: 'var(--surface-3)', color: 'var(--info)' }}
              >
                {buttonText || 'Ilovani ochish'}
              </div>
            </div>
          </div>
        </div>

        <div className="adm-card adm-card-pad text-sm" style={{ color: 'var(--muted)' }}>
          <b style={{ color: 'var(--ink)' }}>Eslatma.</b> Telegram bir soniyada ~30 ta xabarni
          qabul qiladi. Katta ro'yxatga yuborish bir necha daqiqa davom etishi mumkin — sahifani
          yopmang. Botni bloklagan mijozlarga xabar bormaydi, bu xato hisoblanmaydi.
        </div>
      </div>
    </div>
  )
}
