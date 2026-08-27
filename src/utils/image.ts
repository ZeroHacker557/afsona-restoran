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
 * Shuning uchun har bir rasm shu yerda JPEG'ga aylantiriladi va
 * chegaradan kichik bo'lguncha siqiladi.
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

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Rasmni JPEG'ga aylantiradi va `maxBytes` dan kichik bo'lguncha siqadi.
 *
 * @param maxSide  eng uzun tomon, piksel
 * @param maxBytes ruxsat etilgan eng katta hajm
 */
export async function prepareImage(
  file: File,
  { maxSide = 1400, maxBytes = 6_500_000 }: { maxSide?: number; maxBytes?: number } = {},
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

      const blob = await toBlob(canvas, quality)
      if (blob && blob.size <= maxBytes) {
        // Asl fayl kichikroq bo'lsa (masalan allaqachon siqilgan), o'shani olamiz
        if (file.type.startsWith('image/') && file.size < blob.size && file.size <= maxBytes) {
          return { blob: file, contentType: file.type }
        }
        return { blob, contentType: 'image/jpeg' }
      }
    }

    throw new Error('Rasm juda katta. Kichikroq rasm tanlang.')
  } finally {
    source.close()
  }
}
