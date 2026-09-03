/**
 * Rasmni yuklashdan oldin tayyorlash.
 *
 * Nega kerak: Storage qoidalari faqat `image/*` turdagi va hajmi
 * chegaradan kichik fayllarni qabul qiladi. Telefondan kelgan rasm
 * ko'pincha 5–12 MB bo'ladi, ba'zan turi ham noto'g'ri ko'rsatiladi
 * (Telegram WebView, Android galereyasi, iPhone HEIC). Bunday fayl
 * to'g'ridan-to'g'ri yuborilsa, foydalanuvchi tushunarsiz
 * "storage/unauthorized" xatosini ko'radi.
 *
 * Shuning uchun har bir rasm shu yerda qayta kodlanadi va chegaradan
 * kichik bo'lguncha siqiladi.
 *
 * Format: odatda JPEG — u eng ixcham. Lekin JPEG'da SHAFFOFLIK YO'Q:
 * shaffof piksellar qora bo'lib qoladi. Shuning uchun `keepAlpha`
 * berilgan va rasmda haqiqatan shaffof joy bo'lsa, WebP ishlatiladi
 * (u ham siqadi, ham shaffoflikni saqlaydi).
 */

export type PreparedImage = {
  blob: Blob
  /** Storage'ga aynan shu tur yuboriladi — hech qachon bo'sh emas. */
  contentType: string
}

/** Rasmni dekodlash. createImageBitmap ishlamasa, <img> orqali. */
async function decode(file: Blob): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        close: () => bitmap.close(),
      }
    } catch {
      // HEIC va ba'zi WebView'lar — quyidagi usulga o'tamiz
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Rasmni o‘qib bo‘lmadi'))
      element.src = url
    })
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(image, 0, 0, w, h),
      close: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Rasmda shaffof joy bormi.
 *
 * Kichik nusxada tekshiramiz — bu tez va sezgirroq: kichraytirishda
 * alfa o'rtachalanadi, ya'ni kichkina shaffof burchak ham 255 dan
 * past qiymat berib qoladi.
 */
function hasTransparency(
  source: { width: number; height: number; draw: (c: CanvasRenderingContext2D, w: number, h: number) => void },
): boolean {
  try {
    const probe = document.createElement('canvas')
    const side = 64
    const scale = Math.min(1, side / Math.max(source.width, source.height))
    probe.width = Math.max(Math.round(source.width * scale), 1)
    probe.height = Math.max(Math.round(source.height * scale), 1)

    const ctx = probe.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false

    ctx.clearRect(0, 0, probe.width, probe.height)
    source.draw(ctx, probe.width, probe.height)

    const { data } = ctx.getImageData(0, 0, probe.width, probe.height)
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true
    }
    return false
  } catch {
    // O'qib bo'lmasa — shaffof emas deb hisoblaymiz (eski xatti-harakat)
    return false
  }
}

/**
 * Rasmni qayta kodlaydi va `maxBytes` dan kichik bo'lguncha siqadi.
 *
 * @param maxSide   eng uzun tomon, piksel
 * @param maxBytes  ruxsat etilgan eng katta hajm
 * @param keepAlpha shaffoflikni saqlash kerakmi. Menyu rasmlari uchun
 *                  — ha (shaffof PNG qora bo'lib qolmasin). Telegramga
 *                  ketadigan rasmlar uchun — yo'q, u yerda JPEG kerak.
 */
export async function prepareImage(
  file: File,
  {
    maxSide = 1400,
    maxBytes = 6_500_000,
    keepAlpha = false,
  }: { maxSide?: number; maxBytes?: number; keepAlpha?: boolean } = {},
): Promise<PreparedImage> {
  // GIF va SVG'ni qayta chizsak animatsiya/vektor yo'qoladi — hajmi
  // joyida bo'lsa, o'zini yuboramiz.
  const asIs = file.type === 'image/gif' || file.type === 'image/svg+xml'
  if (asIs && file.size <= maxBytes) {
    return { blob: file, contentType: file.type }
  }

  const source = await decode(file).catch(() => null)

  // Dekodlab bo'lmadi: turi rasm va hajmi joyida bo'lsa — o'zini yuboramiz
  if (!source) {
    if (file.type.startsWith('image/') && file.size <= maxBytes) {
      return { blob: file, contentType: file.type }
    }
    throw new Error('Rasmni o‘qib bo‘lmadi. Boshqa rasm tanlang.')
  }

  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Brauzer rasmni qayta ishlay olmadi')

    /*
       Shaffof rasmni JPEG qilib bo'lmaydi — shaffof joylar qora bo'lib
       qoladi. Menyu kartochkasida bu yaqqol ko'rinadi, ayniqsa yorug'
       rejimda. Bunday holatda WebP ishlatamiz: u shaffoflikni saqlaydi
       va JPEG'ga yaqin siqadi.

       Brauzer WebP chiqara olmasa, `toBlob` o'zi PNG qaytaradi —
       natijaviy `blob.type` ni o'qib, aynan shuni yozamiz.
    */
    const shaffof = keepAlpha && hasTransparency(source)
    const type = shaffof ? 'image/webp' : 'image/jpeg'

    // Kerak bo'lsa bir necha marta kichraytirib ko'ramiz
    for (const [side, quality] of [
      [maxSide, 0.85],
      [maxSide, 0.7],
      [1000, 0.7],
      [800, 0.6],
    ] as const) {
      const scale = Math.min(1, side / Math.max(source.width, source.height))
      canvas.width = Math.max(Math.round(source.width * scale), 1)
      canvas.height = Math.max(Math.round(source.height * scale), 1)

      context.clearRect(0, 0, canvas.width, canvas.height)
      source.draw(context, canvas.width, canvas.height)

      const blob = await toBlob(canvas, quality, type)
      if (blob && blob.size <= maxBytes) {
        // Asl fayl kichikroq bo'lsa (masalan allaqachon siqilgan), o'shani
        // olamiz. Shaffof rasmda bu ayniqsa foydali: asl PNG saqlanadi.
        if (file.type.startsWith('image/') && file.size < blob.size && file.size <= maxBytes) {
          return { blob: file, contentType: file.type }
        }
        // Brauzer so'ralgan formatni bermasa, haqiqiy turini yozamiz
        return { blob, contentType: blob.type || type }
      }
    }

    throw new Error('Rasm juda katta. Kichikroq rasm tanlang.')
  } finally {
    source.close()
  }
}
