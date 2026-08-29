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

async function call(method: string, payload: Record<string, unknown>): Promise<SendResult> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${token()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'tarmoq xatosi' }
  }

  const data = (await response.json().catch(() => null)) as
    | { ok: boolean; description?: string; error_code?: number; result?: { message_id?: number } }
    | null

  if (data?.ok) return { ok: true, messageId: data.result?.message_id }

  const description = data?.description || `HTTP ${response.status}`
  // 403 — foydalanuvchi botni bloklagan yoki hech qachon ochmagan.
  const blocked = data?.error_code === 403 || /blocked|deactivated|chat not found/i.test(description)
  return { ok: false, error: description, blocked }
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

export function sendPhoto(chatId: number | string, photo: string, caption?: string, buttons?: Button[]) {
  return call('sendPhoto', {
    chat_id: chatId,
    photo,
    caption: caption || undefined,
    parse_mode: 'HTML',
    reply_markup: markup(buttons),
  })
}

export function sendVideo(chatId: number | string, video: string, caption?: string, buttons?: Button[]) {
  return call('sendVideo', {
    chat_id: chatId,
    video,
    caption: caption || undefined,
    parse_mode: 'HTML',
    reply_markup: markup(buttons),
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
