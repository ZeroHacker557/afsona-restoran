/**
 * Telegram Bot API bilan ishlash — serverless funksiyalar uchun.
 *
 * Bot 24/7 yoqiq turishi shart emas: xabarlarni Vercel funksiyasi
 * to'g'ridan-to'g'ri Bot API'ga yuboradi. Bot dasturi faqat mijoz bilan
 * muloqot (/start, tugmalar) uchun kerak.
 */

const API_BASE = 'https://api.telegram.org/bot'

export type SendResult = {
  ok: boolean
  error?: string
  blocked?: boolean
  /** Yuborilgan xabar identifikatori — keyin tahrirlash uchun kerak. */
  messageId?: number
}

function token(): string {
  const value = process.env.BOT_TOKEN
  if (!value) throw new Error('BOT_TOKEN sozlanmagan')
  return value
}

/*
   ── Navbat va qayta urinish ────────────────────────────────

   Telegram chegara qo'yadi: guruhga taxminan 20 xabar/daqiqa, umumiy
   holda ~30 xabar/sekund. Chegaradan oshilsa `429` va `retry_after`
   qaytadi — ya'ni "shuncha sekund kutib, qayta urin".

   Ilgari na navbat, na qayta urinish bor edi: chaqiruvlar ketma-ket,
   to'xtovsiz ketardi va chegaraga urilgan xabar jimgina yo'qolardi
   (xato faqat Vercel jurnaliga tushardi). Ko'p buyurtmali kunda yoki
   xabarnoma paytida bu sezilarli bo'ladi.

   Endi barcha chaqiruvlar bitta navbatdan o'tadi: orasida kichik
   tanaffus bilan, `429` da esa Telegram aytgan vaqtni kutib qayta
   urinish bilan.

   Chegara: navbat BITTA funksiya nusxasi ichida ishlaydi. Vercel bir
   vaqtda bir nechta nusxa ishga tushirsa, ular bir-birini ko'rmaydi.
   Shunga qaramay foyda katta — portlash aynan bitta chaqiruv ichida
   bo'ladi (xabarnoma paketi, kuryerlarga tarqatish). To'liq global
   cheklov uchun tashqi navbat kerak bo'lardi.
*/

/** Ketma-ket so'rovlar orasidagi eng kichik tanaffus (millisekund). */
const GAP_MS = 40

/** `429` da nechta marta qayta urinamiz. */
const RETRIES = 2

let queue: Promise<unknown> = Promise.resolve()

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Chaqiruvlarni navbatga qo'yadi — ular bir vaqtda ketmaydi. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task)
  // Navbat xato tufayli uzilib qolmasin
  queue = result.then(
    () => sleep(GAP_MS),
    () => sleep(GAP_MS),
  )
  return result
}

async function once(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE}${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = (await response.json().catch(() => null)) as
    | {
        ok: boolean
        description?: string
        error_code?: number
        result?: { message_id?: number }
        parameters?: { retry_after?: number }
      }
    | null

  return { status: response.status, data }
}

async function call(method: string, payload: Record<string, unknown>): Promise<SendResult> {
  return enqueue(async () => {
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      let result
      try {
        result = await once(method, payload)
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'tarmoq xatosi' }
      }

      const { status, data } = result
      if (data?.ok) return { ok: true, messageId: data.result?.message_id }

      const description = data?.description || `HTTP ${status}`

      // 429 — chegaraga urildik. Telegram qancha kutishni o'zi aytadi.
      if (data?.error_code === 429 && attempt < RETRIES) {
        const wait = Math.min(Number(data.parameters?.retry_after) || 1, 30)
        console.warn(`[telegram] ${method}: chegara, ${wait}s kutamiz`)
        await sleep(wait * 1000 + 250)
        continue
      }

      // 403 — foydalanuvchi botni bloklagan yoki hech qachon ochmagan.
      const blocked =
        data?.error_code === 403 || /blocked|deactivated|chat not found/i.test(description)
      return { ok: false, error: description, blocked }
    }

    return { ok: false, error: 'Telegram chegarasi — qayta urinishlar tugadi' }
  })
}

export type Button = {
  text: string
  /** `callback` berilgan tugmada ishlatilmaydi. */
  url: string
  /**
   * true — tugma mini app'ni TELEGRAM ICHIDA ochadi (web_app).
   * false/berilmagan — oddiy havola, ya'ni brauzerda ochiladi.
   *
   * Telegram cheklovi: web_app tugmasi faqat SHAXSIY chatlarda ishlaydi.
   * Guruhga yuboriladigan xabarlarda oddiy havolani ishlating.
   */
  miniApp?: boolean
  /**
   * Tugma bosilganda botga yuboriladigan ma'lumot (callback_data).
   * DIQQAT: bunday tugmani kimdir bosganda unga javob beradigan dastur
   * (bot/bot.py) ishlab turishi shart — Vercel funksiyasi callback'ni
   * eshitmaydi. Shuning uchun `url`/`miniApp` bo'lsa, o'sha afzal.
   */
  callback?: string
}

function markup(buttons?: Button[]) {
  if (!buttons?.length) return undefined
  return {
    inline_keyboard: buttons.map((button) => [
      button.callback
        ? { text: button.text, callback_data: button.callback }
        : button.miniApp
          ? { text: button.text, web_app: { url: button.url } }
          : { text: button.text, url: button.url },
    ]),
  }
}

export function sendMessage(chatId: number | string, text: string, buttons?: Button[]) {
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: markup(buttons),
  })
}

export function sendPhoto(
  chatId: number | string,
  photo: string,
  caption?: string,
  buttons?: Button[],
  silent?: boolean,
) {
  return call('sendPhoto', {
    chat_id: chatId,
    photo,
    caption: caption || undefined,
    parse_mode: 'HTML',
    reply_markup: markup(buttons),
    disable_notification: silent || undefined,
  })
}

export function sendVideo(
  chatId: number | string,
  video: string,
  caption?: string,
  buttons?: Button[],
  silent?: boolean,
) {
  return call('sendVideo', {
    chat_id: chatId,
    video,
    caption: caption || undefined,
    parse_mode: 'HTML',
    reply_markup: markup(buttons),
    disable_notification: silent || undefined,
  })
}

/** Media turiga qarab to'g'ri metodni tanlaydi. */
export function sendAny(
  chatId: number | string,
  opts: { text: string; photoUrl?: string; videoUrl?: string; buttons?: Button[] },
): Promise<SendResult> {
  if (opts.videoUrl) return sendVideo(chatId, opts.videoUrl, opts.text, opts.buttons)
  if (opts.photoUrl) return sendPhoto(chatId, opts.photoUrl, opts.text, opts.buttons)
  return sendMessage(chatId, opts.text, opts.buttons)
}

/**
 * Yuborilgan xabarni tahrirlaydi — matnini ham, tugmalarini ham.
 * Kuryer tugmani bosgach, o'sha xabarning o'zi yangilanadi: eski tugma
 * yo'qoladi, o'rniga keyingi qadam chiqadi.
 */
export function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  buttons?: Button[],
) {
  return call('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: markup(buttons),
  })
}

/** Rasm/video ostidagi izohni tahrirlaydi (matnli xabar uchun emas). */
export function editMessageCaption(
  chatId: number | string,
  messageId: number,
  caption: string,
  buttons?: Button[],
) {
  return call('editMessageCaption', {
    chat_id: chatId,
    message_id: messageId,
    caption,
    parse_mode: 'HTML',
    reply_markup: markup(buttons),
  })
}

/** Xabarni o'chiradi. Kanal postlari uchun ham ishlaydi. */
export function deleteMessage(chatId: number | string, messageId: number) {
  return call('deleteMessage', { chat_id: chatId, message_id: messageId })
}

/**
 * Xaritadagi nuqtani Telegram lokatsiyasi ko'rinishida yuboradi — ya'ni
 * odam qo'lda "Location" tashlagandagi kabi. Kuryer uni bosib
 * to'g'ridan-to'g'ri navigatorda ocha oladi.
 */
export function sendLocation(chatId: number | string, latitude: number, longitude: number) {
  return call('sendLocation', { chat_id: chatId, latitude, longitude })
}

/** HTML parse_mode uchun xavfli belgilarni ekranlaydi. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
