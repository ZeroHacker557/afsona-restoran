import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from './firebase'
import { auth } from './auth'
import { apiPost } from './api'

/**
 * To'lov chekini yuborish.
 *
 * Rasm brauzerdan to'g'ridan-to'g'ri Firebase Storage'ga chiqadi (Vercel
 * funksiyasidagi hajm chegarasiga tushmaslik uchun), so'ng havola
 * /api/receipt orqali buyurtmaga bog'lanadi va adminlarga xabar ketadi.
 */

const MAX_SIDE = 1400

async function compress(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
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

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  return blob && blob.size < file.size ? blob : file
}

export async function sendReceipt(orderId: string, file: File): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Tizimga kirilmagan')
  if (!file.type.startsWith('image/')) throw new Error('Faqat rasm yuboring')

  const blob = await compress(file)
  const target = ref(storage, `receipts/${uid}/${orderId}_${Date.now()}.jpg`)
  await uploadBytes(target, blob, { contentType: blob.type || 'image/jpeg' })
  const url = await getDownloadURL(target)

  await apiPost('/api/receipt', { orderId, url })
}
