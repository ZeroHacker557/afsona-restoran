import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { DEFAULT_HOURS, readHours, type WorkingHours } from '../../utils/hours'

/**
 * Panelning ma'lumotlar qatlami.
 *
 * Katalog (taom, kategoriya, promokod, sozlama) to'g'ridan-to'g'ri
 * Firestore'ga yoziladi: qoidalar `admin` claim'ni tekshiradi. Shu tufayli
 * o'zgarish bir zumda mijozlar ilovasida ham ko'rinadi (onSnapshot).
 *
 * Buyurtma statusi bundan mustasno — u /api/admin orqali o'tadi, chunki
 * mijozga Telegram xabari ham yuborilishi kerak.
 */

// ── Turlar ───────────────────────────────────────────────────

export type AdminProduct = {
  /** Hujjat id'si — raqamli matn ("482913"). Mini app uni songa aylantiradi. */
  id: string
  name: string
  price: number
  oldPrice?: number | null
  category: string
  images: string[]
  description?: string
  discount?: string
  stock?: number | null
  /** false — stop-list: ilovada "mavjud emas" deb ko'rsatiladi. */
  available?: boolean
  rating?: number
  reviews?: number
  sortOrder?: number
}

export type AdminCategory = {
  id: string
  name: string
  icon: string
  sortOrder?: number
}

export type AdminPromo = {
  id: string
  code: string
  discountPercent: number
  active: boolean
  usageCount: number
  /** ISO sana yoki null — muddatsiz. */
  expiresAt?: string | null
  minOrderTotal?: number
  maxUses?: number
  firstOrderOnly?: boolean
  usedBy?: number[]
}

export type AdminOrder = {
  id: string
  orderNumber: string
  createdAt: string
  status: string
  paymentMethod?: string
  paymentStatus?: string | null
  receiptUrl?: string | null
  total: number
  subtotal?: number
  discount?: number
  discountPercent?: number
  promoCode?: string | null
  deliveryFee?: number
  userId?: number
  username?: string | null
  /** Buyurtmani olgan kuryer (Telegram tugmasi orqali). */
  courierId?: number | null
  courierName?: string | null
  claimedAt?: string | null
  deliveredAt?: string | null
  /** Bekor qilish/rad etish sababi. */
  cancelReason?: string | null
  products: {
    product: { id: number | string; name: string; price: number; images?: string[] }
    quantity: number
    size?: string | null
    color?: string | null
  }[]
  customer: {
    name?: string
    phone?: string
    address?: string
    comment?: string
    paymentMethod?: string
    location?: { lat: number; lng: number } | null
  }
}

export type AdminUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  phone?: string
  photo_url?: string
  lastActive?: string
  language?: string
}

// ── Umumiy yordamchilar ──────────────────────────────────────

type Unsub = () => void

function watch<T>(
  path: string,
  map: (id: string, data: Record<string, unknown>) => T,
  onData: (items: T[]) => void,
  onError?: (error: unknown) => void,
): Unsub {
  return onSnapshot(
    collection(db, path),
    (snap) => onData(snap.docs.map((d) => map(d.id, d.data() as Record<string, unknown>))),
    (error) => {
      console.error(`[admin-db] ${path}:`, error)
      onError?.(error)
    },
  )
}

const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const str = (value: unknown, fallback = ''): string =>
  value === null || value === undefined ? fallback : String(value)

// ── Taomlar ──────────────────────────────────────────────────

export function watchProducts(onData: (items: AdminProduct[]) => void, onError?: (e: unknown) => void) {
  return watch<AdminProduct>(
    'products',
    (id, data) => ({
      id,
      name: str(data.name),
      price: num(data.price),
      oldPrice: data.oldPrice == null ? null : num(data.oldPrice),
      category: str(data.category),
      images: Array.isArray(data.images) ? (data.images as string[]) : [],
      description: str(data.description),
      discount: str(data.discount),
      stock: typeof data.stock === 'number' ? data.stock : null,
      available: data.available !== false,
      rating: num(data.rating, 5),
      reviews: num(data.reviews),
      sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : undefined,
    }),
    // Avval qo'lda belgilangan tartib (sudrab qo'yilgan), keyin nom bo'yicha.
    // sortOrder yo'q taomlar oxirida turadi — ular hali tartiblanmagan.
    (items) =>
      onData(
        items.sort(
          (a, b) =>
            (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
            a.name.localeCompare(b.name, 'uz'),
        ),
      ),
    onError,
  )
}

/** Bot bilan bir xil qoida: hujjat id'si — raqamli matn. */
async function freeProductId(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const id = String(Math.floor(Math.random() * 900000) + 100000)
    const existing = await getDoc(doc(db, 'products', id))
    if (!existing.exists()) return id
  }
  return String(Date.now()).slice(-6)
}

export async function createProduct(input: Omit<AdminProduct, 'id'>): Promise<string> {
  const id = await freeProductId()
  await setDoc(doc(db, 'products', id), {
    id,
    name: input.name,
    price: input.price,
    oldPrice: input.oldPrice ?? null,
    category: input.category,
    images: input.images,
    description: input.description ?? '',
    discount: input.discount ?? '',
    stock: input.stock ?? 0,
    available: input.available !== false,
    rating: 5,
    reviews: 0,
    sizes: [],
    color: '',
  })
  return id
}

export function updateProduct(id: string, updates: Partial<AdminProduct>) {
  return updateDoc(doc(db, 'products', id), updates as Record<string, unknown>)
}

export function deleteProduct(id: string) {
  return deleteDoc(doc(db, 'products', id))
}

/** Bir nechta taomni birdaniga o'chirish. */
export async function deleteProducts(ids: string[]) {
  const batch = writeBatch(db)
  ids.forEach((id) => batch.delete(doc(db, 'products', id)))
  await batch.commit()
}

/** Tanlangan taomlar narxini foizda o'zgartirish (+10 / −15). */
export async function shiftPrices(ids: string[], percent: number, products: AdminProduct[]) {
  const batch = writeBatch(db)
  const map = new Map(products.map((p) => [p.id, p]))
  ids.forEach((id) => {
    const product = map.get(id)
    if (!product) return
    const next = Math.max(Math.round((product.price * (100 + percent)) / 100), 0)
    batch.update(doc(db, 'products', id), { price: next })
  })
  await batch.commit()
}

// ── Kategoriyalar ────────────────────────────────────────────

export function watchCategories(onData: (items: AdminCategory[]) => void, onError?: (e: unknown) => void) {
  return watch<AdminCategory>(
    'categories',
    (id, data) => ({
      id,
      name: str(data.name),
      icon: str(data.icon, 'package'),
      sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : undefined,
    }),
    (items) =>
      onData(
        items.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name, 'uz')),
      ),
    onError,
  )
}

export async function createCategory(name: string, icon = 'package') {
  const id = String(Math.floor(Math.random() * 90000) + 10000)
  await setDoc(doc(db, 'categories', id), { id, name, icon, sortOrder: Date.now() % 100000 })
  return id
}

/**
 * Kategoriya nomi o'zgarsa, ichidagi taomlarning `category` maydoni ham
 * yangilanishi shart — taomlar nom bo'yicha bog'langan.
 */
export async function renameCategory(id: string, oldName: string, newName: string): Promise<number> {
  const affected = await getDocs(query(collection(db, 'products'), where('category', '==', oldName)))
  const batch = writeBatch(db)
  batch.update(doc(db, 'categories', id), { name: newName })
  affected.docs.forEach((snap) => batch.update(snap.ref, { category: newName }))
  await batch.commit()
  return affected.size
}

export function updateCategory(id: string, updates: Partial<AdminCategory>) {
  return updateDoc(doc(db, 'categories', id), updates as Record<string, unknown>)
}

export function deleteCategory(id: string) {
  return deleteDoc(doc(db, 'categories', id))
}

export async function countProductsInCategory(name: string): Promise<number> {
  const snap = await getDocs(query(collection(db, 'products'), where('category', '==', name)))
  return snap.size
}

/**
 * Taomlar tartibini saqlash — ilovada shu tartibda ko'rinadi.
 *
 * Firestore bitta batch'ga 500 tagacha amal sig'diradi. Katta menyuda
 * shu chegaraga urilib qolmaslik uchun bo'laklarga bo'lib yozamiz.
 */
export async function saveProductOrder(ids: string[]) {
  const CHUNK = 400
  for (let start = 0; start < ids.length; start += CHUNK) {
    const batch = writeBatch(db)
    ids.slice(start, start + CHUNK).forEach((id, offset) => {
      batch.update(doc(db, 'products', id), { sortOrder: start + offset })
    })
    await batch.commit()
  }
}

/** Kategoriyalar tartibini saqlash. */
export async function saveCategoryOrder(ids: string[]) {
  const batch = writeBatch(db)
  ids.forEach((id, index) => batch.update(doc(db, 'categories', id), { sortOrder: index }))
  await batch.commit()
}

// ── Buyurtmalar ──────────────────────────────────────────────

export function watchOrders(onData: (items: AdminOrder[]) => void, onError?: (e: unknown) => void) {
  return watch<AdminOrder>(
    'orders',
    (id, data) => ({
      id,
      orderNumber: str(data.orderNumber, `#${id.slice(0, 6)}`),
      createdAt: str(data.createdAt),
      status: str(data.status, 'Yangi'),
      paymentMethod: str(data.paymentMethod, 'Naqd'),
      paymentStatus: data.paymentStatus == null ? null : str(data.paymentStatus),
      receiptUrl: data.receiptUrl == null ? null : str(data.receiptUrl),
      total: num(data.total),
      subtotal: num(data.subtotal),
      discount: num(data.discount),
      discountPercent: num(data.discountPercent),
      promoCode: data.promoCode == null ? null : str(data.promoCode),
      deliveryFee: num(data.deliveryFee),
      userId: num(data.userId),
      username: data.username == null ? null : str(data.username),
      courierId: data.courierId == null ? null : num(data.courierId),
      courierName: data.courierName == null ? null : str(data.courierName),
      claimedAt: data.claimedAt == null ? null : str(data.claimedAt),
      deliveredAt: data.deliveredAt == null ? null : str(data.deliveredAt),
      cancelReason: data.cancelReason == null ? null : str(data.cancelReason),
      products: Array.isArray(data.products) ? (data.products as AdminOrder['products']) : [],
      customer: (data.customer || {}) as AdminOrder['customer'],
    }),
    (items) =>
      onData(items.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))),
    onError,
  )
}

// ── Promokodlar ──────────────────────────────────────────────

export function watchPromos(onData: (items: AdminPromo[]) => void, onError?: (e: unknown) => void) {
  return watch<AdminPromo>(
    'promocodes',
    (id, data) => ({
      id,
      code: str(data.code).toUpperCase(),
      discountPercent: num(data.discountPercent),
      active: data.active !== false,
      usageCount: num(data.usageCount),
      expiresAt: data.expiresAt == null ? null : str(data.expiresAt),
      minOrderTotal: num(data.minOrderTotal),
      maxUses: num(data.maxUses),
      firstOrderOnly: data.firstOrderOnly === true,
      usedBy: Array.isArray(data.usedBy) ? (data.usedBy as number[]) : [],
    }),
    (items) => onData(items.sort((a, b) => a.code.localeCompare(b.code))),
    onError,
  )
}

export async function createPromo(input: Omit<AdminPromo, 'id' | 'usageCount' | 'usedBy'>) {
  const id = `promo_${Date.now()}`
  await setDoc(doc(db, 'promocodes', id), {
    code: input.code.trim().toUpperCase(),
    discountPercent: input.discountPercent,
    active: input.active,
    expiresAt: input.expiresAt || null,
    minOrderTotal: input.minOrderTotal || 0,
    maxUses: input.maxUses || 0,
    firstOrderOnly: input.firstOrderOnly === true,
    usageCount: 0,
    usedBy: [],
  })
  return id
}

export function updatePromo(id: string, updates: Partial<AdminPromo>) {
  return updateDoc(doc(db, 'promocodes', id), updates as Record<string, unknown>)
}

export function deletePromo(id: string) {
  return deleteDoc(doc(db, 'promocodes', id))
}

// ── Mijozlar ─────────────────────────────────────────────────

export function watchUsers(onData: (items: AdminUser[]) => void, onError?: (e: unknown) => void) {
  return watch<AdminUser>(
    'users',
    (id, data) => ({
      id: num(data.id, Number(id) || 0),
      first_name: str(data.first_name),
      last_name: str(data.last_name),
      username: str(data.username),
      phone: str(data.phone),
      photo_url: str(data.photo_url),
      lastActive: str(data.lastActive),
      language: str(data.language),
    }),
    (items) =>
      onData(items.sort((a, b) => (Date.parse(b.lastActive || '') || 0) - (Date.parse(a.lastActive || '') || 0))),
    onError,
  )
}

// ── Sozlamalar ───────────────────────────────────────────────

export type DeliverySettings = { fee: number; freeFrom: number; minOrder: number }
export type PaymentSettings = { cardNumber: string; cardOwner: string }
export type BrandSettings = {
  name: string
  phone: string
  telegram: string
  email: string
  address: string
}

export function watchSetting<T>(
  docId: string,
  map: (data: Record<string, unknown> | undefined) => T,
  onData: (value: T) => void,
) {
  return onSnapshot(
    doc(db, 'settings', docId),
    (snap) => onData(map(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)),
    (error) => console.error(`[admin-db] settings/${docId}:`, error),
  )
}

export const readDelivery = (data?: Record<string, unknown>): DeliverySettings => ({
  fee: num(data?.fee),
  freeFrom: num(data?.freeFrom),
  minOrder: num(data?.minOrder),
})

export const readPayment = (data?: Record<string, unknown>): PaymentSettings => ({
  cardNumber: str(data?.cardNumber),
  cardOwner: str(data?.cardOwner),
})

export const readBrand = (data?: Record<string, unknown>): BrandSettings => ({
  name: str(data?.name),
  phone: str(data?.phone),
  telegram: str(data?.telegram),
  email: str(data?.email),
  address: str(data?.address),
})

export const readHoursDoc = (data?: Record<string, unknown>): WorkingHours =>
  data ? readHours(data) : DEFAULT_HOURS

export type Courier = { id: number; name: string; phone?: string; active?: boolean }
export type CourierSettings = {
  list: Courier[]
  groupChatId: number | null
  groupTitle: string
  mode: 'private' | 'group' | 'both'
}

export const readCouriers = (data?: Record<string, unknown>): CourierSettings => {
  const raw = Array.isArray(data?.list) ? (data.list as Record<string, unknown>[]) : []
  const group = num(data?.groupChatId)
  const mode = data?.mode

  return {
    list: raw
      .map((item) => ({
        id: num(item?.id),
        name: str(item?.name),
        phone: str(item?.phone) || undefined,
        active: item?.active !== false,
      }))
      .filter((item) => item.id !== 0),
    groupChatId: group === 0 ? null : group,
    groupTitle: str(data?.groupTitle),
    mode: mode === 'private' || mode === 'group' ? mode : 'both',
  }
}

// ── Kanal ────────────────────────────────────────────────────

export type ChannelSettings = { chatId: number | null; title: string; username: string }

export const readChannel = (data?: Record<string, unknown>): ChannelSettings => {
  const chatId = num(data?.chatId)
  return {
    chatId: chatId === 0 ? null : chatId,
    title: str(data?.title),
    username: str(data?.username),
  }
}

export type ChannelPost = {
  id: string
  text: string
  photoUrl?: string | null
  videoUrl?: string | null
  buttonText?: string | null
  expired: boolean
  createdAt: string
}

export function watchChannelPosts(
  onData: (items: ChannelPost[]) => void,
  onError?: (e: unknown) => void,
) {
  return watch<ChannelPost>(
    'channelPosts',
    (id, data) => ({
      id,
      text: str(data.text),
      photoUrl: data.photoUrl == null ? null : str(data.photoUrl),
      videoUrl: data.videoUrl == null ? null : str(data.videoUrl),
      buttonText: data.buttonText == null ? null : str(data.buttonText),
      expired: data.expired === true,
      createdAt: str(data.createdAt),
    }),
    (items) =>
      onData(
        items
          .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
          .slice(0, 40),
      ),
    onError,
  )
}

export function saveSetting(docId: string, value: Record<string, unknown>) {
  return setDoc(doc(db, 'settings', docId), value, { merge: true })
}
