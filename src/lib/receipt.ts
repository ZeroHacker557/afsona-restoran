import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from './firebase'
import { auth } from './auth'
import { apiPost } from './api'
import { prepareImage } from '../utils/image'

/**
 * To'lov chekini yuborish.
 *
 * Rasm brauzerdan to'g'ridan-to'g'ri Firebase Storage'ga chiqadi (Vercel
 * funksiyasidagi hajm chegarasiga tushmaslik uchun), so'ng havola
 * /api/receipt orqali buyurtmaga bog'lanadi va adminlarga xabar ketadi.
 */

export async function sendReceipt(orderId: string, file: File): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Tizimga kirilmagan')

  // Chek — doim JPEG va 8 MB dan kichik bo'lishi shart (Storage qoidasi).
  // prepareImage buni kafolatlaydi: telefondan kelgan katta rasm ham,
  // turi noto'g'ri ko'rsatilgan fayl ham shu yerda tartibga solinadi.
  const { blob, contentType } = await prepareImage(file)

  const target = ref(storage, `receipts/${uid}/${orderId}_${Date.now()}.jpg`)
  await uploadBytes(target, blob, { contentType })
  const url = await getDownloadURL(target)

  await apiPost('/api/receipt', { orderId, url })
}
