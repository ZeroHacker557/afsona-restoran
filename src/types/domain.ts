export type AppPage =
  | 'home' | 'catalog' | 'favorites' | 'orders' | 'profile'
  | 'detail' | 'checkout' | 'addresses' | 'profile_edit'
  | 'reviews' | 'notifications' | 'language' | 'support'

export type Product = {
  id: number
  name: string
  price: number
  oldPrice?: number
  category: string
  rating: number
  reviews: number
  images: string[]
  description?: string
  discount?: string
  /** Ombordagi qoldiq. undefined — hisob yuritilmaydi (eski mahsulotlar). */
  stock?: number
  /** false — stop-list: taom vaqtincha sotuvda emas. */
  available?: boolean
  /** Admin panelda sudrab belgilangan tartib. Kichik son — yuqorida. */
  sortOrder?: number
  /**
   * Idish narxi — bir porsiya uchun, so'mda.
   *
   * Bo'sh (undefined yoki 0) — taom idishsiz beriladi va mijozga hech
   * narsa ko'rsatilmaydi. Qiymat bo'lsa — taom idish bilan beriladi va
   * shu summa har bir porsiya uchun qo'shiladi.
   */
  containerPrice?: number
}

export type Category = {
  id: number
  name: string
  icon: string
  image?: string
  /** Admin panelda belgilangan tartib. Kichik son — birinchi. */
  sortOrder?: number
}

/**
 * Buyurtmani mijoz qanday oladi.
 *
 * Maydon yo'q (undefined) — yetkazib berish. Eski buyurtmalarda bu
 * maydon bo'lmaydi, ular avvalgidek yetkazish bo'lib qolaveradi.
 */
export type DeliveryType = 'delivery' | 'pickup'

export type OrderStatus = 'Yangi' | 'Qabul qilindi' | 'Yetkazilmoqda' | 'Yetkazildi' | 'Bekor qilingan' | 'Rad etildi'

export type Order = {
  /** Firestore hujjat identifikatori — barcha texnik havolalar shu bo'yicha. */
  id: string
  /** Foydalanuvchiga ko'rsatiladigan ketma-ket raqam, masalan "#1042". */
  orderNumber: string
  /** ISO 8601. Saralash va sana ko'rsatish shu maydondan. */
  createdAt: string
  products: { product: Product; quantity: number; size?: string; color?: string; cartKey?: string }[]
  /** Mahsulotlar jami (chegirmasiz, yetkazishsiz). */
  subtotal?: number
  discount?: number
  discountPercent?: number
  promoCode?: string | null
  deliveryFee?: number
  /** Yetkazib berishmi yoki mijoz o'zi olib ketadimi. */
  deliveryType?: DeliveryType
  /**
   * Idishlar uchun jami summa. Chegirma bunga tushmaydi — bu qadoq
   * uchun haqiqiy xarajat.
   */
  containerFee?: number
  /** Yakuniy summa: subtotal - discount + containerFee + deliveryFee. */
  total: number
  status: OrderStatus
  paymentMethod?: 'Naqd' | 'Karta'
  paymentStatus?: 'Tolangan' | 'Kutilmoqda' | 'Rad etildi'
  customer: OrderForm
  userId?: number
  username?: string
  /** Bot bu buyurtmani adminga yuborganmi (F-21). */
  notified?: boolean
  /** Eski yozuvlarda formatlangan sana matni bo'lishi mumkin. */
  date?: string
}

/** Firestore'ga yozishdan oldingi buyurtma — id va raqam server tomonda beriladi. */
export type NewOrder = Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'notified'>

export type PaymentSettings = {
  cardNumber: string
  cardOwner: string
}

export type DeliverySettings = {
  /** Yetkazib berish narxi, so'mda. */
  fee: number
  /** Shu summadan yuqori buyurtmalar bepul yetkaziladi. 0 — bepul yetkazish yo'q. */
  freeFrom: number
  /**
   * Mijoz buyurtmani o'zi kelib olib ketishi mumkinmi.
   *
   * O'chirilgan bo'lsa rasmiylashtirishda tanlov ko'rinmaydi va server
   * ham bunday buyurtmani qabul qilmaydi.
   */
  pickupEnabled?: boolean
}

export type OrderForm = {
  name: string
  phone: string
  /** Olib ketishda bo'sh bo'ladi — manzil so'ralmaydi. */
  address: string
  deliveryType: DeliveryType
  location: { lat: number; lng: number } | null
  comment: string
  paymentMethod: 'Naqd' | 'Karta'
  promoCode?: string
}

export type ProductActions = {
  onOpen: (product: Product) => void
  onAddToCart: (product: Product, size?: string, color?: string) => void
  likedIds: number[]
  onToggleLike: (id: number) => void
}

export type CartItem = {
  productId: number
  quantity: number
}

export type Address = {
  id: string
  name: string
  address: string
  location: { lat: number; lng: number }
}

export type UserProfile = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  phone?: string
  addresses: Address[]
  /** Tanlangan til — qurilmalar orasida sinxron bo'lishi uchun. */
  language?: 'uz' | 'ru'
}

export type Review = {
  id: string
  productId: number
  userId: number
  userName: string
  rating: number // 1 to 5
  comment: string
  date: string
}

export type Notification = {
  id: string
  userId: number
  title: string
  body: string
  date: string
  read: boolean
  type: 'order' | 'system' | 'promo'
}

export type PromoCode = {
  id: string
  code: string
  discountPercent: number
  active: boolean
  usageCount: number
}
