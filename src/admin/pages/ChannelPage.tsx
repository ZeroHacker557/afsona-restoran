import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, Megaphone, Radio, Send, Trash2, Video, X } from 'lucide-react'
import { useAdminData } from '../lib/data-context'
import { adminPost } from '../lib/api'
import { uploadBroadcastMedia } from '../lib/upload'
import {
  readChannel,
  watchChannelPosts,
  watchSetting,
  type ChannelPost,
  type ChannelSettings,
} from '../lib/db'
import { ConfirmBar, Empty, Field, Spinner, Switch } from '../components/ui'
import { formatDateTime, money } from '../lib/format'
import { toast, toastError } from '../lib/toast'
import { BRAND } from '../../config/brand'

/**
 * Kanalga e'lon berish.
 *
 * Rasm yoki videoni admin O'ZI yuklaydi — taomning katalogdagi rasmi
 * avtomatik ketmaydi. Sababi: kanal uchun odatda boshqa rasm kerak
 * bo'ladi (aksiya banneri, video), va katalog rasmi oq fonda "do'kon"
 * ko'rinishida bo'ladi — lentada yaxshi ishlamaydi.
 *
 * Taom tanlansa, matn shabloni avtomatik to'ldiriladi, lekin admin uni
 * xohlagancha tahrirlaydi: restoran o'z ovozida gapirishi kerak.
 */

const BOT_LINK = `https://t.me/${BRAND.botUsername}`

export function ChannelPage() {
  const { products } = useAdminData()
  const [channel, setChannel] = useState<ChannelSettings | null>(null)
  const [posts, setPosts] = useState<ChannelPost[]>([])

  useEffect(() => watchSetting('channel', readChannel, setChannel), [])
  useEffect(() => watchChannelPosts(setPosts), [])

  if (!channel) return <Spinner center />

  return (
    <div className="flex flex-col gap-4">
      {channel.chatId ? (
        <Composer products={products} />
      ) : (
        <ConnectHelp />
      )}

      {channel.chatId && <ChannelInfo channel={channel} />}
      {channel.chatId && <History posts={posts} />}
    </div>
  )
}

/* ── Kanal ulanmagan ─────────────────────────────── */

function ConnectHelp() {
  return (
    <div className="adm-card adm-card-pad">
      <div className="mb-3 flex items-center gap-2 font-bold">
        <Radio size={17} />
        Kanal biriktirilmagan
      </div>
      <ol
        className="ml-4 flex list-decimal flex-col gap-2 text-sm"
        style={{ color: 'var(--ink-2)' }}
      >
        <li>Telegramda kanalingizni oching</li>
        <li>
          <b>@{BRAND.botUsername}</b> ni kanalga <b>administrator</b> qilib qo'shing
        </li>
        <li>
          Unga <b>«Post messages»</b> huquqini bering — boshqa huquq kerak emas
        </li>
        <li>Tamom. Kanal shu yerda o'zi paydo bo'ladi, hech narsa yozish shart emas</li>
      </ol>
      <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
        Bot ishlab turgan bo'lishi kerak — kanalga qo'shilganini u eshitadi.
      </p>
    </div>
  )
}

function ChannelInfo({ channel }: { channel: ChannelSettings }) {
  const [unbinding, setUnbinding] = useState(false)

  return (
    <div className="adm-card adm-card-pad">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-bold">
            <Radio size={16} style={{ color: 'var(--success)' }} />
            {channel.title || 'Kanal'}
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            {channel.username ? `@${channel.username} · ` : ''}
            ID {channel.chatId}
          </p>
        </div>
        <button className="adm-btn sm" onClick={() => setUnbinding(true)}>
          Uzish
        </button>
      </div>

      {unbinding && (
        <div className="mt-3">
          <ConfirmBar
            text="Kanal uziladi. Postlar kanalda qoladi. Davom etamizmi?"
            onCancel={() => setUnbinding(false)}
            onConfirm={async () => {
              try {
                await adminPost('channel.unbind')
                toast('Kanal uzildi')
              } catch (error) {
                toastError(error)
              } finally {
                setUnbinding(false)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}

/* ── Post yozish ─────────────────────────────────── */

type Product = ReturnType<typeof useAdminData>['products'][number]

function Composer({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState('')
  const [text, setText] = useState('')
  const [buttonText, setButtonText] = useState("🛒 Buyurtma berish")
  const [buttonUrl, setButtonUrl] = useState(BOT_LINK)
  const [silent, setSilent] = useState(false)
  const [media, setMedia] = useState<{ url: string; kind: 'photo' | 'video' } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const discounted = useMemo(
    () => products.filter((item) => item.oldPrice && item.oldPrice > item.price),
    [products],
  )

  /** Taom tanlanganda matnni shablondan to'ldiramiz. */
  function pickProduct(id: string) {
    setProductId(id)
    if (!id) return

    const item = products.find((product) => product.id === id)
    if (!item) return

    const old = Number(item.oldPrice) || 0
    const now = Number(item.price) || 0
    const percent = old > now ? Math.round(((old - now) / old) * 100) : 0

    const lines: string[] = []
    if (percent) {
      lines.push(`🔥 <b>CHEGIRMA · −${percent}%</b>`, '')
      lines.push(`<b>${item.name}</b>`)
      lines.push(`<s>${money(old)}</s> → <b>${money(now)}</b>`)
    } else {
      lines.push(`🍽 <b>${item.name}</b>`, '')
      lines.push(`<b>${money(now)}</b>`)
    }
    if (item.description) lines.push('', item.description.slice(0, 200))

    setText(lines.join('\n'))
  }

  async function pickMedia(file?: File) {
    if (!file) return
    const kind = file.type.startsWith('video/') ? 'video' : 'photo'

    setUploading(true)
    try {
      const url = await uploadBroadcastMedia(file)
      setMedia({ url, kind })
    } catch (error) {
      toastError(error)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function send() {
    if (!text.trim() && !media) {
      toastError(new Error('Matn yoki rasm qo‘shing'))
      return
    }

    setSending(true)
    try {
      await adminPost('channel.post', {
        text,
        photoUrl: media?.kind === 'photo' ? media.url : undefined,
        videoUrl: media?.kind === 'video' ? media.url : undefined,
        buttonText: buttonText.trim() || undefined,
        buttonUrl: buttonUrl.trim() || undefined,
        silent,
        productId: productId || undefined,
      })
      toast('Kanalga yuborildi')
      setText('')
      setMedia(null)
      setProductId('')
    } catch (error) {
      toastError(error)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="adm-card adm-card-pad">
      <div className="mb-4 flex items-center gap-2 font-bold">
        <Megaphone size={17} />
        Yangi e'lon
      </div>

      <div className="flex flex-col gap-4">
        <Field
          label="Taom"
          hint="Tanlansa, matn o‘zi to‘ldiriladi. Keyin xohlagancha tahrirlaysiz."
        >
          <select
            className="adm-input"
            value={productId}
            onChange={(event) => pickProduct(event.target.value)}
          >
            <option value="">— tanlanmagan —</option>
            {discounted.length > 0 && (
              <optgroup label="Chegirmadagilar">
                {discounted.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Barcha taomlar">
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>

        {/* ── Media ──────────────────────────── */}
        <div>
          <span className="adm-label">Rasm yoki video</span>

          {media ? (
            <div className="flex items-center gap-3">
              {media.kind === 'photo' ? (
                <img
                  src={media.url}
                  alt=""
                  className="size-20 rounded-[10px] object-cover"
                  style={{ border: '1px solid var(--line)' }}
                />
              ) : (
                <span
                  className="grid size-20 place-items-center rounded-[10px]"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--line)' }}
                >
                  <Video size={22} />
                </span>
              )}
              <button className="adm-btn sm" onClick={() => setMedia(null)}>
                <X size={14} />
                Olib tashlash
              </button>
            </div>
          ) : (
            <button
              className="adm-btn w-full"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Spinner /> : <Image size={16} />}
              {uploading ? 'Yuklanmoqda…' : 'Rasm yoki video yuklash'}
            </button>
          )}

          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(event) => pickMedia(event.target.files?.[0])}
          />
          <span className="adm-hint block">
            Taomning katalogdagi rasmi avtomatik yuborilmaydi — kanal uchun mos rasmni
            o‘zingiz tanlaysiz. Video 45 MB gacha.
          </span>
        </div>

        <Field label="Matn" hint="Qalin yozish uchun <b>matn</b>, chizish uchun <s>matn</s>">
          <textarea
            className="adm-input"
            rows={7}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="🔥 CHEGIRMA · −18%&#10;&#10;Toy oshi&#10;55 000 so'm → 45 000 so'm"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tugma matni">
            <input
              className="adm-input"
              value={buttonText}
              onChange={(event) => setButtonText(event.target.value)}
              placeholder="🛒 Buyurtma berish"
            />
          </Field>
          <Field label="Tugma havolasi" hint="Bo‘sh qoldirilsa tugma chiqmaydi">
            <input
              className="adm-input"
              value={buttonUrl}
              onChange={(event) => setButtonUrl(event.target.value)}
              placeholder={BOT_LINK}
            />
          </Field>
        </div>

        <Switch
          checked={silent}
          onChange={setSilent}
          label="Ovozsiz yuborish"
          hint="Obunachilarga bildirishnoma bormaydi — kundalik e'lonlar uchun qulay"
        />

        <button className="adm-btn primary" onClick={send} disabled={sending || uploading}>
          {sending ? <Spinner /> : <Send size={16} />}
          Kanalga yuborish
        </button>
      </div>
    </div>
  )
}

/* ── Yuborilgan postlar ──────────────────────────── */

function History({ posts }: { posts: ChannelPost[] }) {
  const [busy, setBusy] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)

  async function run(action: string, postId: string, done: string) {
    setBusy(postId)
    try {
      await adminPost(action, { postId })
      toast(done)
      setRemoving(null)
    } catch (error) {
      toastError(error)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <span>Yuborilgan e'lonlar</span>
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {posts.length} ta
        </span>
      </div>

      {posts.length === 0 ? (
        <div className="p-4">
          <Empty text="Hozircha e'lon yuborilmagan" icon={<Megaphone size={26} />} />
        </div>
      ) : (
        <div className="flex flex-col">
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex flex-wrap items-start gap-3 border-t px-4 py-3"
              style={{ borderColor: 'var(--line-soft)' }}
            >
              {post.photoUrl && (
                <img
                  src={post.photoUrl}
                  alt=""
                  className="size-12 rounded-lg object-cover"
                  style={{ border: '1px solid var(--line)' }}
                />
              )}

              <div className="min-w-0 flex-1">
                <p
                  className="text-sm"
                  style={{
                    color: post.expired ? 'var(--muted)' : 'var(--ink)',
                    textDecoration: post.expired ? 'line-through' : 'none',
                  }}
                >
                  {post.text.replace(/<[^>]+>/g, '').slice(0, 90) ||
                    (post.videoUrl ? 'Video' : 'Rasm')}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                  {formatDateTime(post.createdAt)}
                  {post.expired ? ' · aksiya tugagan' : ''}
                </p>
              </div>

              <div className="flex gap-2">
                {!post.expired && (
                  <button
                    className="adm-btn sm"
                    onClick={() => run('channel.expire', post.id, 'Aksiya tugadi deb belgilandi')}
                    disabled={busy === post.id}
                  >
                    Aksiya tugadi
                  </button>
                )}
                <button
                  className="adm-icon-btn"
                  onClick={() => setRemoving(post.id)}
                  aria-label="O'chirish"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {removing === post.id && (
                <div className="w-full">
                  <ConfirmBar
                    text="Post kanaldan o'chiriladi. Davom etamizmi?"
                    onCancel={() => setRemoving(null)}
                    onConfirm={() => run('channel.delete', post.id, "Post o'chirildi")}
                    busy={busy === post.id}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
