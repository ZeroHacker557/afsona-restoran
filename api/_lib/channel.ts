import { adminDb } from './firebase-admin.js'
import {
  deleteMessage,
  editMessageCaption,
  editMessageText,
  sendMessage,
  sendPhoto,
  sendVideo,
  type Button,
} from './telegram.js'

/**
 * Telegram kanalga e'lon berish.
 *
 * Kanal admin panelidan boshqariladi: post matnini, rasm yoki videoni va
 * tugmani admin o'zi tanlaydi. Taomning katalogdagi rasmi AVTOMATIK
 * yuborilmaydi — kanalga mos rasm odatda boshqacha bo'ladi (aksiya
 * banneri, video), shuning uchun uni admin alohida yuklaydi.
 *
 * Post yuborilgach `channelPosts` to'plamiga yozib qo'yiladi: keyin uni
 * "Aksiya tugadi" deb belgilash yoki butunlay o'chirish mumkin. Busiz
 * kanal eskirgan, aldamchi e'lonlar bilan to'lib ketadi.
 */

export type ChannelSettings = {
  chatId: number | null
  title: string
  username: string
}

const SETTINGS_DOC = 'channel'
const POSTS = 'channelPosts'

export async function readChannel(): Promise<ChannelSettings> {
  const empty: ChannelSettings = { chatId: null, title: '', username: '' }
  try {
    const snap = await (await adminDb()).collection('settings').doc(SETTINGS_DOC).get()
    if (!snap.exists) return empty

    const data = snap.data() || {}
    const chatId = Number(data.chatId)
    return {
      chatId: Number.isFinite(chatId) && chatId !== 0 ? chatId : null,
      title: String(data.title || ''),
      username: String(data.username || ''),
    }
  } catch (error) {
    console.error('[channel] sozlama o‘qilmadi:', error)
    return empty
  }
}

/**
 * Bot kanalga administrator qilib qo'shilganda chaqiriladi.
 * Kanal o'zi biriktiriladi — admin hech qanday buyruq yozmaydi.
 */
export async function bindChannel(chatId: number, title: string, username: string) {
  await (await adminDb())
    .collection('settings')
    .doc(SETTINGS_DOC)
    .set(
      { chatId, title: title.slice(0, 120), username: username.slice(0, 64) },
      { merge: true },
    )
}

export async function unbindChannel() {
  await (await adminDb())
    .collection('settings')
    .doc(SETTINGS_DOC)
    .set({ chatId: null, title: '', username: '' }, { merge: true })
}

// ── Post yuborish ────────────────────────────────────────────

export type PostInput = {
  text: string
  /** Adminning o'zi yuklagan rasm — taom rasmi emas. */
  photoUrl?: string
  videoUrl?: string
  buttonText?: string
  buttonUrl?: string
  /** Ovozsiz yuborish — kunlik e'lonlar obunachini bezovta qilmasin. */
  silent?: boolean
  /** Qaysi taom haqida — keyin "aksiya tugadi" deb belgilash uchun. */
  productId?: string
}

export type PostResult = { ok: boolean; error?: string; postId?: string }

export async function sendChannelPost(input: PostInput): Promise<PostResult> {
  const channel = await readChannel()
  if (!channel.chatId) {
    return { ok: false, error: 'Kanal biriktirilmagan' }
  }

  const text = String(input.text || '').trim().slice(0, 1000)
  if (!text && !input.photoUrl && !input.videoUrl) {
    return { ok: false, error: 'Post bo‘sh' }
  }

  const buttons: Button[] =
    input.buttonText && input.buttonUrl
      ? [{ text: String(input.buttonText).slice(0, 40), url: String(input.buttonUrl) }]
      : []

  const result = input.videoUrl
    ? await sendVideo(channel.chatId, input.videoUrl, text, buttons, input.silent)
    : input.photoUrl
      ? await sendPhoto(channel.chatId, input.photoUrl, text, buttons, input.silent)
      : await sendMessage(channel.chatId, text, buttons)

  if (!result.ok || !result.messageId) {
    return { ok: false, error: result.error || 'Yuborilmadi' }
  }

  const doc = await (await adminDb()).collection(POSTS).add({
    chatId: channel.chatId,
    messageId: result.messageId,
    text,
    photoUrl: input.photoUrl || null,
    videoUrl: input.videoUrl || null,
    buttonText: input.buttonText || null,
    buttonUrl: input.buttonUrl || null,
    productId: input.productId || null,
    hasMedia: Boolean(input.photoUrl || input.videoUrl),
    expired: false,
    createdAt: new Date().toISOString(),
  })

  return { ok: true, postId: doc.id }
}

async function loadPost(postId: string) {
  const ref = (await adminDb()).collection(POSTS).doc(postId)
  const snap = await ref.get()
  return snap.exists ? { ref, data: snap.data() as Record<string, unknown> } : null
}

/**
 * Aksiya tugaganini bildiradi: postning matni chizib tashlanadi va
 * tugmasi olib tashlanadi. Post o'chirilmaydi — kanal tarixi qoladi,
 * lekin mijoz eskirgan narxni bosib aldanmaydi.
 */
export async function expireChannelPost(postId: string): Promise<PostResult> {
  const post = await loadPost(postId)
  if (!post) return { ok: false, error: 'Post topilmadi' }
  if (post.data.expired) return { ok: false, error: 'Allaqachon belgilangan' }

  const chatId = Number(post.data.chatId)
  const messageId = Number(post.data.messageId)
  const original = String(post.data.text || '')

  const caption = `<s>${original.replace(/<\/?s>/g, '')}</s>\n\n⏳ <b>Aksiya tugadi</b>`

  const result = post.data.hasMedia
    ? await editMessageCaption(chatId, messageId, caption, [])
    : await editMessageText(chatId, messageId, caption, [])

  if (!result.ok) return { ok: false, error: result.error || 'Tahrirlanmadi' }

  await post.ref.update({ expired: true, expiredAt: new Date().toISOString() })
  return { ok: true, postId }
}

/** Postni kanaldan butunlay o'chiradi. */
export async function deleteChannelPost(postId: string): Promise<PostResult> {
  const post = await loadPost(postId)
  if (!post) return { ok: false, error: 'Post topilmadi' }

  const result = await deleteMessage(Number(post.data.chatId), Number(post.data.messageId))
  // Telegram 48 soatdan eski postni o'chirishga ruxsat bermasligi mumkin —
  // u holda ham yozuvni bazadan olib tashlaymiz, aks holda ro'yxatda
  // o'chirib bo'lmaydigan qator qolib ketadi.
  if (!result.ok) console.error('[channel] o‘chirilmadi:', result.error)

  await post.ref.delete()
  return { ok: true }
}
