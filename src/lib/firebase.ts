import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, onSnapshot, query, where, doc, setDoc, updateDoc, writeBatch, getDocs, getDoc, runTransaction } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { parseDate } from '../utils/date'
import type { Product, Category, Order, NewOrder, PaymentSettings, Notification } from '../types/domain'

const firebaseConfig = {
  apiKey: "AIzaSyB-JENf9xTOJcEF81-6KJxb0HnCyLmjkc0",
  authDomain: "ecommercytest.firebaseapp.com",
  projectId: "ecommercytest",
  storageBucket: "ecommercytest.firebasestorage.app",
  messagingSenderId: "107932467075",
  appId: "1:107932467075:web:1d2740db24de18661c00b6",
  measurementId: "G-TFYZD2LLN0"
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Real-time Firestore Listeners
export function subscribeToProducts(callback: (products: Product[]) => void, onError?: (err: unknown) => void) {
  console.log('[Firebase] Subscribing to products collection...')
  const productsRef = collection(db, 'products')
  return onSnapshot(productsRef, (snapshot) => {
    console.log(`[Firebase] Products snapshot received: ${snapshot.size} documents`)
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
        sizes: data.sizes || [],
        color: data.color || '',
        description: data.description || '',
        discount: data.discount || ''
      }
    })
    callback(products)
  }, (error) => {
    console.error('[Firebase] Products snapshot ERROR:', error)
    console.error('[Firebase] This usually means Firestore Security Rules are blocking read access.')
    console.error('[Firebase] Go to Firebase Console → Firestore → Rules and set: allow read: if true;')
    if (onError) onError(error)
  })
}

export function subscribeToCategories(callback: (categories: Category[]) => void, onError?: (err: unknown) => void) {
  console.log('[Firebase] Subscribing to categories collection...')
  const categoriesRef = collection(db, 'categories')
  return onSnapshot(categoriesRef, (snapshot) => {
    console.log(`[Firebase] Categories snapshot received: ${snapshot.size} documents`)
    const categories: Category[] = snapshot.docs.map((doc) => {
      const data = doc.data()
      const rawId = data.id || doc.id
      const numId = typeof rawId === 'number' ? rawId : (parseInt(String(rawId), 10) || Math.abs(hashString(doc.id)))
      
      return {
        id: numId,
        name: data.name || '',
        icon: data.icon || 'package'
      }
    })
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

const ORDER_NUMBER_START = 1000

/**
 * Ketma-ket buyurtma raqamini transaction ichida oladi.
 * Bu FAQAT ko'rsatish uchun — buyurtmaning haqiqiy kaliti Firestore doc.id.
 * Hisoblagich ishlamay qolsa buyurtma baribir yaratiladi (zaxira raqam bilan).
 */
async function nextOrderNumber(): Promise<string> {
  try {
    const counterRef = doc(db, 'counters', 'orders')
    const value = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef)
      const current = snap.exists() ? Number(snap.data().value) || ORDER_NUMBER_START : ORDER_NUMBER_START
      const next = current + 1
      tx.set(counterRef, { value: next }, { merge: true })
      return next
    })
    return `#${value}`
  } catch (error) {
    console.warn('[Firebase] Buyurtma hisoblagichi ishlamadi, zaxira raqam ishlatildi:', error)
    return `#${Date.now().toString().slice(-8)}`
  }
}

/**
 * Buyurtmani Firestore'ga yozadi va {id, orderNumber} qaytaradi.
 * Xatoni YUTMAYDI — chaqiruvchi uni ushlab, foydalanuvchiga xabar berishi shart (F-05).
 */
export async function sendOrderToFirestore(order: NewOrder): Promise<{ id: string; orderNumber: string }> {
  const orderNumber = await nextOrderNumber()
  const cleanOrder = JSON.parse(JSON.stringify(order))

  const ref = await addDoc(collection(db, 'orders'), {
    ...cleanOrder,
    orderNumber,
    createdAt: new Date().toISOString(),
    // Bot shu bayroq bo'yicha ishlaydi: vaqtga emas, holatga tayanadi (F-21)
    notified: false,
  })

  return { id: ref.id, orderNumber }
}

// ── PAYMENT SETTINGS ─────────────────────────────────────────

const PAYMENT_FALLBACK: PaymentSettings = {
  cardNumber: '',
  cardOwner: '',
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

// User Management
export async function saveUserToFirestore(user: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string }) {
  try {
    const usersRef = collection(db, 'users')
    await setDoc(doc(usersRef, String(user.id)), {
      ...user,
      lastActive: new Date().toISOString()
    }, { merge: true })
  } catch (error) {
    console.error("Error saving user to Firestore:", error)
  }
}

export function subscribeToUserProfile(userId: number, callback: (profile: any) => void) {
  const userRef = doc(db, 'users', String(userId))
  
  return onSnapshot(userRef, (snapshot: any) => {
    if (snapshot.exists()) {
      callback(snapshot.data())
    } else {
      callback(null)
    }
  }, (error: any) => {
    console.error("Error fetching user profile:", error)
  })
}

export async function updateUserProfile(userId: number, data: any) {
  try {
    const userRef = doc(db, 'users', String(userId))
    await updateDoc(userRef, data)
  } catch (error) {
    console.error("Error updating user profile:", error)
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

export async function addReview(review: Omit<Review, 'id'>) {
  try {
    const reviewsRef = collection(db, 'reviews')
    await addDoc(reviewsRef, review)
  } catch (error) {
    console.error("Error adding review:", error)
    throw error
  }
}

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
    callback(notifs)
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
