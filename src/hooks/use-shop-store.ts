import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { subscribeToCategories, subscribeToProducts, subscribeToUserOrders, subscribeToUserProfile, subscribeToUserNotifications, markNotificationsAsRead, subscribeToHours } from '../lib/firebase'
import { ensureSignedIn, onAuthChanged, auth } from '../lib/auth'
import { apiPost, ApiError } from '../lib/api'
import { track } from '../lib/track'
import { searchProducts } from '../utils/search'
import { containerTotal } from '../utils/pricing'
import type { AppPage, Category, Order, OrderForm, Product, UserProfile, Notification } from '../types/domain'
import { hapticError, hapticFeedback, hapticSuccess, initTelegram } from '../utils/telegram'
import { applyTheme, getStoredTheme, storeTheme, type ThemeMode } from '../utils/theme'
import { DEFAULT_HOURS, getOpenState, type OpenState, type WorkingHours } from '../utils/hours'
import { useT } from '../i18n'

/** Pastki menyudagi asosiy sahifalar — ularga o'tganda tarix tozalanadi. */
const ROOT_PAGES: AppPage[] = ['home', 'catalog', 'favorites', 'orders', 'profile']

const LIKES_KEY = 'shopOnlineLikes'
const CART_KEY = 'shopOnlineCart'

/*
   Savat: taom kaliti → miqdor.

   Ilgari kalit `${id}_${o'lcham}_${rang}` shaklida edi — kiyim do'koni
   shablonidan qolgan. Restoran menyusida o'lcham va rang yo'q, ularni
   admin panelda kiritish imkoni ham yo'q edi, ya'ni ular hech qachon
   to'ldirilmasdi. Kalit endi shunchaki taom id'si.

   Eski saqlangan savatlar ham ishlayveradi: id kalitning birinchi
   qismidan olinadi (`key.split('_')[0]`).
*/
type CartItems = Record<string, { quantity: number }>

function loadLikes(): number[] {
  try {
    return JSON.parse(localStorage.getItem(LIKES_KEY) || '[]')
  } catch { return [] }
}

function saveLikes(ids: number[]) {
  localStorage.setItem(LIKES_KEY, JSON.stringify(ids))
}

/** Savat saqlanadi: Telegram mini app'ni yopib-ochganda yo'qolmasligi uchun (F-14). */
/** Takroriy buyurtmani to'sish uchun noyob kalit. */
function newOrderKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function loadCart(): CartItems {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    return raw as CartItems
  } catch { return {} }
}

/** Havoladagi ?page= qiymati — faqat ruxsat etilgan bo'limlar. */
const START_PAGES: AppPage[] = ['home', 'catalog', 'favorites', 'orders', 'profile']

function readStartPage(): AppPage {
  try {
    const value = new URLSearchParams(window.location.search).get('page') as AppPage | null
    return value && START_PAGES.includes(value) ? value : 'home'
  } catch {
    return 'home'
  }
}


export function useShopStore() {
  const t = useT()
  // Bot «Buyurtmalarim» tugmasi ilovani to'g'ridan-to'g'ri o'sha
  // bo'limda ochadi: MINI_APP_URL/?page=orders
  const [page, setPage] = useState<AppPage>(readStartPage)
  // Telegram BackButton shu tarix bo'yicha ishlaydi (D-03)
  const [history, setHistory] = useState<AppPage[]>([])
  // Bosh sahifadan tanlangan kategoriya katalogga uzatiladi (F-16)
  const [catalogCategory, setCatalogCategory] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [likedIds, setLikedIds] = useState<number[]>(loadLikes)
  const [cartItems, setCartItems] = useState<CartItems>(loadCart)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isSearchOpen, setSearchOpen] = useState(false)
  const [isCartOpen, setCartOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [checkoutDone, setCheckoutDone] = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  /*
   * "Yuklanmoqda" bilan "haqiqatan bo'sh" ni ajratish uchun.
   *
   * `authReady` faqat kirish tugaganini bildiradi — Firestore esa birinchi
   * javobini keyinroq beradi. Oradagi bir necha yuz millisekundda ro'yxat
   * bo'm-bo'sh bo'ladi va ekranda "buyurtmalar yo'q" chaqnab o'tadi.
   * Foydalanuvchida "ma'lumotim yo'qoldi" degan taassurot qoladi.
   */
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [notificationsLoaded, setNotificationsLoaded] = useState(false)
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme)
  // Bitta rasmiylashtirish uchun bitta kalit. Xato bo'lsa saqlanadi —
  // qayta urinishda server yangi buyurtma yaratmaydi.
  const orderKeyRef = useRef<string | null>(null)
  // "Buyurtma qabul qilindi" kartasini o'zi yopadigan taymer
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isAuthenticated, setAuthenticated] = useState(false)
  const [orderForm, setOrderForm] = useState<OrderForm>({
    name: '', phone: '', address: '', location: null, comment: '', paymentMethod: 'Naqd',
  })
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)
  // Restoran ish vaqti. Savatga qo'shish har doim ishlaydi — tekshiruv
  // faqat buyurtma berishda (shunda savat yo'qolmaydi).
  const [hours, setHours] = useState<WorkingHours>(DEFAULT_HOURS)
  const [closedNotice, setClosedNotice] = useState<OpenState | null>(null)

  // Ochiq ma'lumot: katalog. Auth kutilmaydi — Rules'da o'qish ochiq.
  useEffect(() => {
    initTelegram()

    const unsubProds = subscribeToProducts(
      (fbProducts) => {
        setProducts(fbProducts)
        setLoading(false)
      },
      () => setLoading(false),
    )

    const unsubCats = subscribeToCategories(
      (fbCats) => setCategories(fbCats),
      () => {},
    )

    const unsubHours = subscribeToHours(setHours)

    return () => {
      unsubProds()
      unsubCats()
      unsubHours()
    }
  }, [])

  // Shaxsiy ma'lumot: faqat Telegram imzosi tekshirilgandan keyin (F-02).
  // Tizimga kirmagan holatda Rules bu kolleksiyalarni bermaydi, shuning
  // uchun umuman obuna bo'lmaymiz.
  useEffect(() => {
    ensureSignedIn()

    let unsubOrders: (() => void) | undefined
    let unsubProfile: (() => void) | undefined
    let unsubNotifications: (() => void) | undefined

    const stopAll = () => {
      unsubOrders?.()
      unsubProfile?.()
      unsubNotifications?.()
      unsubOrders = undefined
      unsubProfile = undefined
      unsubNotifications = undefined
    }

    const unsubAuth = onAuthChanged((user) => {
      stopAll()

      if (!user) {
        setAuthReady(true)
        setAuthenticated(false)
        setUserProfile(null)
        setMyOrders([])
        setNotifications([])
        setUnreadNotificationsCount(0)
        // Kirilmagan — kutadigan narsa yo'q, "bo'sh" ko'rsatish to'g'ri
        setOrdersLoaded(true)
        setNotificationsLoaded(true)
        return
      }

      const userId = Number(user.uid)
      setAuthReady(true)
      setAuthenticated(true)
      setOrdersLoaded(false)
      setNotificationsLoaded(false)

      unsubOrders = subscribeToUserOrders(userId, (orders) => {
        setMyOrders(orders)
        setOrdersLoaded(true)
      })
      unsubProfile = subscribeToUserProfile(userId, (profile) => {
        if (profile) setUserProfile(profile as UserProfile)
      })
      unsubNotifications = subscribeToUserNotifications(userId, (notifs) => {
        setNotifications(notifs)
        setUnreadNotificationsCount(notifs.filter((n: Notification) => !n.read).length)
        setNotificationsLoaded(true)
      })
    })

    return () => {
      unsubAuth()
      stopAll()
    }
  }, [])

  // Savat har o'zgarganda saqlanadi (F-14)
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cartItems))
    } catch (error) {
      console.warn("[Savat] saqlab bo'lmadi:", error)
    }
  }, [cartItems])

  const cartCount = Object.values(cartItems).reduce((total, item) => total + item.quantity, 0)

  const cartTotal = useMemo(() => {
    return Object.entries(cartItems).reduce((sum, [key, item]) => {
      const pId = Number(key.split('_')[0])
      const p = products.find((pr) => String(pr.id) === String(pId))
      return sum + (p ? p.price * item.quantity : 0)
    }, 0)
  }, [cartItems, products])

  const cartProducts = useMemo(() => {
    return Object.entries(cartItems)
      .map(([key, item]) => {
        const pId = Number(key.split('_')[0])
        const p = products.find((pr) => String(pr.id) === String(pId))
        return p ? { product: p, quantity: item.quantity, cartKey: key } : null
      })
      .filter(Boolean) as { product: Product; quantity: number; cartKey: string }[]
  }, [cartItems, products])

  /*
     Idishlar summasi taom summasidan alohida turadi — chegirma unga
     tushmaydi va bepul yetkazish chegarasiga qo'shilmaydi. Formula
     server bilan bitta faylda (`shared/pricing.ts`), shuning uchun
     mijoz ko'rgan summa chekdagi summaga teng chiqadi.
  */
  const cartContainerTotal = useMemo(() => containerTotal(cartProducts), [cartProducts])

  const searchResults = useMemo(
    () => searchProducts(products, query),
    [query, products],
  )

  const navigate = useCallback((nextPage: AppPage) => {
    const uid = auth.currentUser?.uid
    if (nextPage === 'notifications' && uid) {
      markNotificationsAsRead(Number(uid))
    }

    setPage((current) => {
      if (current === nextPage) return current
      // Asosiy bo'limga o'tilsa tarix tozalanadi, ichki sahifada esa
      // qayerdan kelganimiz eslab qolinadi.
      setHistory((h) =>
        ROOT_PAGES.includes(nextPage) ? [] : [...h.slice(-19), current],
      )
      return nextPage
    })

    setCartOpen(false)
    setSearchOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
    storeTheme(mode)
    applyTheme(mode)
    hapticFeedback('light')
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: ThemeMode = current === 'dark' ? 'light' : 'dark'
      storeTheme(next)
      applyTheme(next)
      return next
    })
    hapticFeedback('light')
  }, [])

  /** Bosh sahifadagi kategoriya bosilganda katalogni filtrlab ochamiz. */
  const openCategory = useCallback((category: string) => {
    setCatalogCategory(category)
    setPage((current) => {
      setHistory(() => (current === 'catalog' ? [] : []))
      return 'catalog'
    })
    setCartOpen(false)
    setSearchOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    hapticFeedback('light')
  }, [])

  /** Orqaga: avval ochiq oyna yopiladi, keyin sahifa tarixi. */
  const goBack = useCallback(() => {
    if (isSearchOpen) {
      setSearchOpen(false)
      return
    }
    if (isCartOpen) {
      setCartOpen(false)
      return
    }
    setHistory((h) => {
      if (h.length === 0) return h
      setPage(h[h.length - 1])
      window.scrollTo({ top: 0 })
      return h.slice(0, -1)
    })
  }, [isSearchOpen, isCartOpen])

  const openProduct = useCallback((product: Product) => {
    setSelectedProduct(product)
    setCartOpen(false)
    setPage((current) => {
      setHistory((h) => [...h.slice(-19), current])
      return 'detail'
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    hapticFeedback('light')
  }, [])

  const toggleLike = useCallback((id: number) => {
    setLikedIds((current) => {
      const next = current.includes(id) ? current.filter((i) => i !== id) : [...current, id]
      saveLikes(next)
      hapticFeedback('light')
      return next
    })
  }, [])

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }, [])

  const addToCart = useCallback((product: Product) => {
    if (product.available === false) {
      notify(t('product.soldOutLong'))
      hapticError()
      return
    }
    const key = String(product.id)
    setCartItems((current) => ({
      ...current,
      [key]: { quantity: (current[key]?.quantity ?? 0) + 1 },
    }))
    notify(t('product.addedToCart', { name: product.name }))
    hapticFeedback('medium')
    track('cart_add', product.id)
  }, [notify, t])

  const updateCartQuantity = useCallback((cartKey: string, nextQuantity: number) => {
    setCartItems((current) => {
      const next = { ...current }
      if (nextQuantity <= 0) delete next[cartKey]
      else next[cartKey] = { ...next[cartKey], quantity: nextQuantity }
      return next
    })
    hapticFeedback('light')
  }, [])

  const openCart = useCallback(() => setCartOpen(true), [])
  const closeCart = useCallback(() => setCartOpen(false), [])

  const goToCheckout = useCallback(() => {
    track('checkout_start')
    setCartOpen(false)
    setPage((current) => {
      setHistory((h) => [...h.slice(-19), current])
      return 'checkout'
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const updateOrderForm = useCallback((field: keyof OrderForm, value: unknown) => {
    setOrderForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  /**
   * Buyurtmani SERVER yaratadi (F-04). Bu yerdan faqat "nimadan nechta"
   * yuboriladi — narx, chegirma va jami serverda qayta hisoblanadi,
   * shuning uchun finalTotal parametri endi kerak emas.
   */
  const submitOrder = useCallback(async () => {
    if (isSubmitting) return false

    if (!orderForm.name.trim() || !orderForm.phone.trim() || !orderForm.address.trim()) {
      notify(t('checkout.fillAll'))
      return false
    }

    if (cartProducts.length === 0) {
      notify(t('checkout.cartEmpty'))
      return false
    }

    // Restoran yopiq bo'lsa buyurtma yuborilmaydi, lekin savat saqlanadi:
    // mijoz ochilish vaqtini ko'radi va keyin qaytadan bosadi.
    const state = getOpenState(hours)
    if (!state.open) {
      setClosedNotice(state)
      hapticError()
      return false
    }

    if (!orderKeyRef.current) orderKeyRef.current = newOrderKey()

    setSubmitting(true)
    try {
      await apiPost<{ id: string; orderNumber: string; total: number }>('/api/orders', {
        clientOrderId: orderKeyRef.current,
        items: cartProducts.map(({ product, quantity }) => ({
          productId: product.id,
          quantity,
        })),
        customer: {
          name: orderForm.name.trim(),
          phone: orderForm.phone.trim(),
          address: orderForm.address.trim(),
          location: orderForm.location,
          comment: orderForm.comment,
          paymentMethod: orderForm.paymentMethod,
        },
        promoCode: orderForm.promoCode,
      })
    } catch (error) {
      // Buyurtma yaratilmadi — savat SAQLANIB qoladi (F-05)
      console.error('[Buyurtma] yuborilmadi:', error)
      hapticError()

      // Server "restoran yopiq" desa (mijoz sahifasi eskirgan bo'lishi
      // mumkin) — quruq xato o'rniga ish vaqti oynasini ko'rsatamiz
      if (error instanceof ApiError && error.status === 409) {
        setClosedNotice(getOpenState(hours))
        return false
      }

      notify(error instanceof ApiError ? error.message : t('checkout.failed'))
      return false
    } finally {
      setSubmitting(false)
    }

    orderKeyRef.current = null
    setCartItems({})
    setOrderForm({ name: '', phone: '', address: '', location: null, comment: '', paymentMethod: 'Naqd' })
    setCheckoutDone(true)
    hapticSuccess()
    notify(t('checkout.success'))

    // Foydalanuvchi tegmasa, karta o'zi yopiladi
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => setCheckoutDone(false), 4000)

    return true
  }, [isSubmitting, orderForm, cartProducts, notify, t, hours])

  /**
   * "Buyurtma qabul qilindi" kartasini darhol yopadi.
   *
   * Ilgari kartani faqat 4 soniyalik taymer yopardi: "Buyurtmalarni
   * ko'rish" bosilganda sahifa almashardi-yu, karta ustida osilib
   * turaverardi.
   */
  const closeCheckoutSuccess = useCallback(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current)
      successTimerRef.current = null
    }
    setCheckoutDone(false)
  }, [])

  // Komponent yopilsa taymer ham to'xtaydi
  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
  }, [])

  return {
    page, history, canGoBack: history.length > 0 || isCartOpen || isSearchOpen,
    products, categories, loading,
    cartItems, cartCount, cartTotal, cartContainerTotal, cartProducts,
    likedIds, selectedProduct,
    isSearchOpen, isCartOpen, query, searchResults, toast,
    myOrders, ordersLoaded, checkoutDone, closeCheckoutSuccess, isSubmitting, authReady, isAuthenticated, orderForm, userProfile,
    notifications, notificationsLoaded, unreadNotificationsCount,
    hours, openState: getOpenState(hours),
    closedNotice, dismissClosedNotice: () => setClosedNotice(null),
    catalogCategory, openCategory,
    theme, setTheme, toggleTheme,
    navigate, goBack, openProduct, toggleLike,
    setSearchOpen, setQuery,
    addToCart, updateCartQuantity,
    openCart, closeCart, goToCheckout,
    updateOrderForm, submitOrder,
    notify, clearToast: () => setToast(null),
  }
}
