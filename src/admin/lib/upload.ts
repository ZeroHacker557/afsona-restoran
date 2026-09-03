import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../../lib/firebase'
import { prepareImage } from '../../utils/image'

/**
 * Rasm/video yuklash — brauzerdan to'g'ridan-to'g'ri Firebase Storage'ga.
 *
 * Vercel funksiyasi orqali o'tkazilmaydi: u yerda so'rov hajmi 4.5 MB bilan
 * cheklangan va fayl ikki marta uzatilishi kerak bo'lardi. Yozish huquqini
 * Storage qoidalari `admin` claim bo'yicha beradi.
 */

/*
   Rasmlar bir yil keshlanadi.

   Firebase Storage sukut bo'yicha `Cache-Control: private, max-age=0`
   qo'yadi — ya'ni brauzer rasmni UMUMAN saqlamaydi va mijoz menyuni
   har ochganda hamma rasm qaytadan yuklanadi. Menyuning sekin
   ochilishining asosiy sababi shu edi.

   `immutable` xavfsiz: fayl nomi vaqt belgisi va tasodifiy qism bilan
   yasaladi, ya'ni bir nom ikkinchi marta ishlatilmaydi. Rasm
   almashtirilsa yangi nom paydo bo'ladi.
*/
const CACHE = 'public, max-age=31536000, immutable'

function safeName(file: File): string {
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5)
  const random = Math.random().toString(36).slice(2, 10)
  return `${Date.now()}_${random}.${extension}`
}

/**
 * Taom rasmi. Qaytadigan qiymat — ochiq (public) havola.
 *
 * `keepAlpha` — shaffof fonli rasm (masalan kesib olingan taom surati)
 * qora fon bilan qolmasligi uchun. Ilgari hamma rasm JPEG'ga
 * aylantirilardi, JPEG'da esa shaffoflik yo'q: shaffof joylar qora
 * bo'lib chiqar va menyuda yaqqol ko'rinardi.
 *
 * `preferWebp` — menyu tezroq ochilishi uchun. WebP bir xil ko'rinishda
 * JPEG'dan ~25-30% yengil, ya'ni sifat o'zgarmaydi-yu, rasm tezroq
 * yuklanadi.
 */
export async function uploadProductImage(file: File): Promise<string> {
  const { blob, contentType } = await prepareImage(file, { keepAlpha: true, preferWebp: true })
  const target = ref(storage, `products/${safeName(file)}`)
  await uploadBytes(target, blob, { contentType, cacheControl: CACHE })
  return getDownloadURL(target)
}

/** Xabarnoma uchun rasm yoki video (Telegram shu havoladan yuklab oladi). */
export async function uploadBroadcastMedia(file: File): Promise<string> {
  // Video siqilmaydi — u qanday bo'lsa, shundayligicha ketadi.
  // Rasm JPEG bo'lib qoladi: bu fayl Telegram'ga yuboriladi, u yerda
  // shaffoflik baribir ko'rinmaydi va JPEG ishonchliroq qabul qilinadi.
  const prepared = file.type.startsWith('image/')
    ? await prepareImage(file)
    : { blob: file as Blob, contentType: file.type || 'application/octet-stream' }

  const target = ref(storage, `broadcast/${safeName(file)}`)
  await uploadBytes(target, prepared.blob, { contentType: prepared.contentType, cacheControl: CACHE })
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
