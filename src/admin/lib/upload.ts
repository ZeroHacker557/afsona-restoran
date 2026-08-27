import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../../lib/firebase'

/**
 * Rasm/video yuklash — brauzerdan to'g'ridan-to'g'ri Firebase Storage'ga.
 *
 * Vercel funksiyasi orqali o'tkazilmaydi: u yerda so'rov hajmi 4.5 MB bilan
 * cheklangan va fayl ikki marta uzatilishi kerak bo'lardi. Yozish huquqini
 * Storage qoidalari `admin` claim bo'yicha beradi.
 */

const MAX_SIDE = 1400
const JPEG_QUALITY = 0.85

/** Katta rasmni brauzerda kichraytiradi — yuklash tez, sahifa yengil. */
async function compress(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 400_000) {
    bitmap.close()
    return file
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return file
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  return blob && blob.size < file.size ? blob : file
}

function safeName(file: File): string {
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5)
  const random = Math.random().toString(36).slice(2, 10)
  return `${Date.now()}_${random}.${extension}`
}

/** Taom rasmi. Qaytadigan qiymat — ochiq (public) havola. */
export async function uploadProductImage(file: File): Promise<string> {
  const blob = await compress(file)
  const target = ref(storage, `products/${safeName(file)}`)
  await uploadBytes(target, blob, { contentType: blob.type || file.type })
  return getDownloadURL(target)
}

/** Xabarnoma uchun rasm yoki video (Telegram shu havoladan yuklab oladi). */
export async function uploadBroadcastMedia(file: File): Promise<string> {
  const isImage = file.type.startsWith('image/')
  const blob = isImage ? await compress(file) : file
  const target = ref(storage, `broadcast/${safeName(file)}`)
  await uploadBytes(target, blob, { contentType: blob.type || file.type })
  return getDownloadURL(target)
}

/** Storage havolasi bo'yicha faylni o'chiradi (boshqa havolalarni tegmaydi). */
export async function removeUploaded(url: string) {
  if (!url.includes('firebasestorage.googleapis.com')) return
  try {
    await deleteObject(ref(storage, url))
  } catch (error) {
    // Fayl allaqachon o'chirilgan bo'lishi mumkin — bu xato emas
    console.warn('[upload] o‘chirib bo‘lmadi:', error)
  }
}
