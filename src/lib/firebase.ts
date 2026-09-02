import { initializeApp } from 'firebase/app'
import { initializeFirestore, collection, onSnapshot, query, where, doc, updateDoc, writeBatch, getDocs, getDoc } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { parseDate } from '../utils/date'
import { DEFAULT_HOURS, readHours, type WorkingHours } from '../utils/hours'
import type { Product, Category, Order, PaymentSettings, DeliverySettings, Notification, UserProfile } from '../types/domain'

// ══════════════════════════════════════════════════════════════
//  FIREBASE KONFIGURATSIYASI — YANGI LOYIHAGA O'TKAZISHDA SHU YER
//
//  Firebase Console → Project Settings → General → Your apps → Web app
//  bo'limidagi qiymatlarni shu yerga ko'chiring. Bu qiymatlar maxfiy
//  emas (ular brauzerga baribir tushadi) — himoya Firestore Rules va
//  Firebase Auth orqali ta'minlanadi.
// ══════════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyAoa0w2OVpLMhickoopnNk621GGoxiqgu4",
  authDomain: "afsona-restorani.firebaseapp.com",
  projectId: "afsona-restorani",
  storageBucket: "afsona-restorani.firebasestorage.app",
  messagingSenderId: "712924363405",
  appId: "1:712924363405:web:22ebd77884a496190c40c4",
  measurementId: "G-3YVL284MSF"
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig)

// MUHIM: Firestore standart "WebChannel" (streaming) transporti Telegram
// ichki brauzerida (WebView) ko'pincha bloklanadi — natijada yozishlar
// (masalan manzil saqlash) hech qachon tugamay "qotib" qoladi. Long-polling
// rejimi bu muhitlarda ishonchli ishlaydi (Telegram Mini App uchun zarur).
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
})
export const storage = getStorage(app)

// Real-time Firestore Listeners
export function subscribeToProducts(callback: (products: Product[]) => void, onError?: (err: unknown) => void) {
  const productsRef = collection(db, 'products')
  return onSnapshot(productsRef, (snapshot) => {
    const products: Product[] = snapshot.docs.map((doc) => {
      const data = doc.data()
      const rawId = data.id || doc.id
      const numId = typeof rawId === 'number' ? rawId : (parseInt(String(rawId), 10) || Math.abs(hashString(doc.id)))
      
      return {
        id: numId,
        name: data.name || '',
        price: Number(data.price) || 0,
        oldPrice: data.oldPrice ? Number(data.oldPrice) : undefined,
        category: data.category || '',
        images: data.images || [],
        rating: data.rating || 5,
        reviews: data.reviews || 0,
        description: data.description || '',
        discount: data.discount || '',
        stock: typeof data.stock === 'number' ? data.stock : undefined,
        // Stop-list: admin panelda o'chirilgan taom savatga tushmaydi
        available: data.available !== false,
        // Admin panelda sudrab belgilangan tartib
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : undefined,
      }
    })
    // Firestore hujjatlarni id bo'yicha qaytaradi — bu tasodifiy tartib.
    // Restoran qaysi taomni yuqorida ko'rsatishni o'zi hal qiladi.
    products.sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name, 'uz'),
    )
    callback(products)
  }, (error) => {
    console.error('[Firebase] Products snapshot ERROR:', error)
    console.error('[Firebase] This usually means Firestore Security Rules are blocking read access.')
    console.error('[Firebase] Go to Firebase Console → Firestore → Rules and set: allow read: if true;')
    if (onError) onError(error)
  })
}

export function subscribeToCategories(callback: (categories: Category[]) => void, onError?: (err: unknown) => void) {
  const categoriesRef = collection(db, 'categories')
  return onSnapshot(categoriesRef, (snapshot) => {
    const categories: Category[] = snapshot.docs.map((doc) => {
      const data = doc.data()
      const rawId = data.id || doc.id
      const numId = typeof rawId === 'number' ? rawId : (parseInt(String(rawId), 10) || Math.abs(hashString(doc.id)))
      
      return {
        id: numId,
        name: data.name || '',
        icon: data.icon || 'package',
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : undefined,
      }
    })
    // Admin paneldagi tartib bilan bir xil bo'lsin
    categories.sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name, 'uz'),
    )
    callback(categories)
  }, (error) => {
    console.error('[Firebase] Categories snapshot ERROR:', error)
    console.error('[Firebase] This usually means Firestore Security Rules are blocking read access.')
    if (onError) onError(error)
  })
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

// ── ORDERS ───────────────────────────────────────────────────

// Buyurtmani mijoz emas, SERVER yaratadi: POST /api/orders.
// Narx, chegirma va jami Firestore'dagi haqiqiy qiymatlardan
// qayta hisoblanadi, shuning uchun bu yerda addDoc yo'q (F-04).

// ── PAYMENT SETTINGS ─────────────────────────────────────────

const PAYMENT_FALLBACK: PaymentSettings = {
  cardNumber: '',
  cardOwner: '',
}

const DELIVERY_FALLBACK: DeliverySettings = { fee: 0, freeFrom: 0 }

/** Yetkazib berish narxi — settings/delivery hujjatidan. */
export async function getDeliverySettings(): Promise<DeliverySettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'delivery'))
    if (!snap.exists()) return DELIVERY_FALLBACK
    const data = snap.data()
    return {
      fee: Math.max(Number(data.fee) || 0, 0),
      freeFrom: Math.max(Number(data.freeFrom) || 0, 0),
    }
  } catch (error) {
    console.error("[Firebase] Yetkazish sozlamalarini o'qib bo'lmadi:", error)
    return DELIVERY_FALLBACK
  }
}

/** Karta ma'lumoti yagona manbadan — settings/payment hujjatidan (F-07). */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'payment'))
    if (!snap.exists()) return PAYMENT_FALLBACK
    const data = snap.data()
    return {
      cardNumber: String(data.cardNumber || PAYMENT_FALLBACK.cardNumber),
      cardOwner: String(data.cardOwner || PAYMENT_FALLBACK.cardOwner),
    }
  } catch (error) {
    console.error("[Firebase] To'lov sozlamalarini o'qib bo'lmadi:", error)
    return PAYMENT_FALLBACK
  }
}

// ── ISH VAQTI VA BREND ───────────────────────────────────────

/**
 * Restoran ish vaqti. Hujjat mavjud bo'lmasa — tekshiruvsiz (doim ochiq)
 * holat qaytadi, ya'ni sozlanmagan baza buyurtmani to'smaydi.
 */
export function subscribeToHours(callback: (hours: WorkingHours) => void) {
  return onSnapshot(
    doc(db, 'settings', 'hours'),
    (snap) => callback(snap.exists() ? readHours(snap.data()) : DEFAULT_HOURS),
    (error) => {
      console.warn('[Firebase] Ish vaqtini o‘qib bo‘lmadi:', error)
      callback(DEFAULT_HOURS)
    },
  )
}

export type BrandInfo = {
  name: string
  phone: string
  telegram: string
  email: string
  address: string
}

/** Aloqa ma'lumotlari — admin panelda o'zgartiriladi. */
export function subscribeToBrand(callback: (brand: Partial<BrandInfo>) => void) {
  return onSnapshot(
    doc(db, 'settings', 'brand'),
    (snap) => callback(snap.exists() ? (snap.data() as Partial<BrandInfo>) : {}),
    (error) => {
      console.warn('[Firebase] Brend ma‘lumotini o‘qib bo‘lmadi:', error)
      callback({})
    },
  )
}

// Foydalanuvchi hujjatini /api/auth yaratadi va yangilaydi.

export function subscribeToUserProfile(userId: number, callback: (profile: UserProfile | null) => void) {
  const userRef = doc(db, 'users', String(userId))
  
  return onSnapshot(userRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as UserProfile)
    } else {
      callback(null)
    }
  }, (error) => {
    console.error("Error fetching user profile:", error)
  })
}

/**
 * Profil maydonlarini yangilaydi.
 *
 * MUHIM: xato YUTILMAYDI. Ilgari u shu yerda console'ga yozilib,
 * chaqiruvchi hech narsa sezmasdi — natijada foydalanuvchi "saqlandi"
 * degan xabarni ko'rar, lekin manzil aslida yozilmagan bo'lardi.
 * Endi chaqiruvchi xatoni ushlab, haqiqiy sababni ko'rsatadi.
 */
export async function updateUserProfile(userId: number, data: Partial<UserProfile>) {
  const userRef = doc(db, 'users', String(userId))
  try {
    await updateDoc(userRef, data)
  } catch (error) {
    console.error('[Firebase] Profil yangilanmadi:', error)
    throw error
  }
}

// Subscribe to User Orders
export function subscribeToUserOrders(userId: number, callback: (orders: Order[]) => void) {
  const ordersRef = collection(db, 'orders')
  // We only use 'where' to avoid requiring a composite index in Firestore.
  // Sorting will be done on the client side.
  const q = query(ordersRef, where('userId', '==', userId))
  
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map((snap) => {
      const data = snap.data()
      return {
        ...data,
        // Haqiqiy kalit — hujjat identifikatori (F-03)
        id: snap.id,
        // Eski buyurtmalarda orderNumber yo'q: o'sha paytdagi "#1234567" ni ko'rsatamiz
        orderNumber: data.orderNumber || data.id || snap.id,
        createdAt: data.createdAt || '',
      } as Order
    })

    orders.sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt))

    callback(orders)
  }, (error) => {
    console.error("Error fetching user orders:", error)
  })
}

// ── REVIEWS ──────────────────────────────────────────────────
import type { Review } from '../types/domain'

// Sharhni /api/reviews yaratadi — mijoz to'g'ridan-to'g'ri yoza olmaydi.

export function subscribeToProductReviews(productId: number, callback: (reviews: Review[]) => void) {
  const reviewsRef = collection(db, 'reviews')
  const q = query(reviewsRef, where('productId', '==', productId))
  
  return onSnapshot(q, (snapshot) => {
    const reviews: Review[] = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    } as Review))
    // sort by newest
    reviews.sort((a, b) => parseDate(b.date) - parseDate(a.date))
    callback(reviews)
  }, (error) => {
    console.error("Error fetching product reviews:", error)
  })
}

export function subscribeToUserReviews(userId: number, callback: (reviews: Review[]) => void) {
  const reviewsRef = collection(db, 'reviews')
  const q = query(reviewsRef, where('userId', '==', userId))
  
  return onSnapshot(q, (snapshot) => {
    const reviews: Review[] = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    } as Review))
    // sort by newest
    reviews.sort((a, b) => parseDate(b.date) - parseDate(a.date))
    callback(reviews)
  }, (error) => {
    console.error("Error fetching user reviews:", error)
  })
}

// ==========================================
// NOTIFICATIONS
// ==========================================

export function subscribeToUserNotifications(userId: number, callback: (notifications: Notification[]) => void) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId)
  )
  return onSnapshot(q, (snapshot) => {
    const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification))
    // ISO sana bo'yicha saralash; eski formatlar oxiriga tushadi (F-10)
    notifs.sort((a, b) => parseDate(b.date) - parseDate(a.date))
    /*
       Ekranga eng yangi 50 tasi chiqadi. Server tomonda ham har mijozda
       saqlanadigan son cheklangan (`pushNotification` eskilarini
       o'chiradi) — bu yerdagi kesish esa qo'shimcha kafolat.

       Firestore'da `where` + `orderBy` birga composite indeks talab
       qiladi, shuning uchun saralash va kesish shu yerda bajariladi.
    */
    callback(notifs.slice(0, 50))
  }, (error) => {
    console.error("Error fetching notifications:", error)
  })
}

export async function markNotificationsAsRead(userId: number) {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    )
    const snapshot = await getDocs(q)
    const batch = writeBatch(db)
    snapshot.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { read: true })
    })
    await batch.commit()
  } catch (e) {
    console.error('Error marking notifications as read', e)
  }
}
