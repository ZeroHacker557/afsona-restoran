import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3,
  Bell,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Ticket,
  UtensilsCrossed,
  Users,
  Bike,
  Radio,
} from 'lucide-react'
import { claimAdmin, onAdminAuthChanged, signOutAdmin } from './lib/auth'
import { AdminDataProvider } from './store'
import { useAdminData } from './lib/data-context'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductsPage } from './pages/ProductsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { PromosPage } from './pages/PromosPage'
import { BroadcastPage } from './pages/BroadcastPage'
import { CustomersPage } from './pages/CustomersPage'
import { StatsPage } from './pages/StatsPage'
import { SettingsPage } from './pages/SettingsPage'
import { CouriersPage } from './pages/CouriersPage'
import { ChannelPage } from './pages/ChannelPage'
import { AdminsPage } from './pages/AdminsPage'
import { ToastHost } from './components/Toast'
import { toast } from './lib/toast'
import { Spinner } from './components/ui'
import { BRAND, LOGO } from '../config/brand'
import { applyTheme, getStoredTheme, storeTheme, type ThemeMode } from '../utils/theme'
import { getOpenState } from '../utils/hours'
import { saveSetting } from './lib/db'

type Route =
  | 'dashboard' | 'orders' | 'products' | 'categories' | 'promos'
  | 'broadcast' | 'customers' | 'stats' | 'settings' | 'couriers' | 'channel' | 'admins'

const NAV: { id: Route; label: string; icon: typeof LayoutDashboard; group?: string }[] = [
  { id: 'dashboard', label: 'Bosh sahifa', icon: LayoutDashboard },
  { id: 'orders', label: 'Buyurtmalar', icon: ShoppingBag },
  { id: 'products', label: 'Taomlar', icon: UtensilsCrossed, group: 'Katalog' },
  { id: 'categories', label: 'Kategoriyalar', icon: FolderTree },
  { id: 'promos', label: 'Promokodlar', icon: Ticket },
  { id: 'couriers', label: 'Kuryerlar', icon: Bike },
  { id: 'broadcast', label: 'Xabarnoma', icon: Megaphone, group: 'Mijozlar' },
  { id: 'channel', label: 'Kanal', icon: Radio },
  { id: 'customers', label: 'Mijozlar', icon: Users },
  { id: 'stats', label: 'Statistika', icon: BarChart3, group: 'Boshqaruv' },
  { id: 'settings', label: 'Sozlamalar', icon: Settings },
  { id: 'admins', label: 'Adminlar', icon: ShieldCheck },
]

const TITLES: Record<Route, string> = {
  dashboard: 'Bosh sahifa',
  orders: 'Buyurtmalar',
  products: 'Taomlar',
  categories: 'Kategoriyalar',
  promos: 'Promokodlar',
  broadcast: 'Xabarnoma',
  customers: 'Mijozlar',
  stats: 'Statistika',
  settings: 'Sozlamalar',
  couriers: 'Kuryerlar',
  channel: 'Kanal',
  admins: 'Adminlar',
}

function readRoute(): Route {
  const hash = window.location.hash.replace('#', '') as Route
  return TITLES[hash] ? hash : 'dashboard'
}

/** Yon menyu holati shu kalit ostida saqlanadi. */
const SIDEBAR_KEY = 'afsona-admin-sidebar'

export default function AdminApp() {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking')
  const [email, setEmail] = useState('')

  useEffect(() => {
    return onAdminAuthChanged(async (user) => {
      if (!user) {
        setState('out')
        return
      }
      try {
        const session = await claimAdmin(user)
        setEmail(session.email)
        setState('in')
      } catch (error) {
        // Ro'yxatdan chiqarilgan yoki huquqi yo'q
        console.warn('[admin] ruxsat yo‘q:', error)
        await signOutAdmin().catch(() => {})
        setState('out')
      }
    })
  }, [])

  if (state === 'checking') {
    return (
      <main className="grid min-h-[100dvh] place-items-center" style={{ background: 'var(--bg)' }}>
        <Spinner center />
      </main>
    )
  }

  if (state === 'out') {
    return (
      <>
        <LoginPage />
        <ToastHost />
      </>
    )
  }

  return (
    <AdminDataProvider>
      <Shell email={email} />
      <ToastHost />
    </AdminDataProvider>
  )
}

function Shell({ email }: { email: string }) {
  const [route, setRoute] = useState<Route>(readRoute)
  const [menuOpen, setMenuOpen] = useState(false)
  /**
   * Katta ekranda yon menyu yig'ilganmi. Tanlov saqlanadi — admin har
   * safar qaytadan bosmasin.
   */
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch {
      return false
    }
  })

  function toggleSidebar() {
    // Kichik ekranda menyu — chetdan chiqadigan panel, u yerda yig'ish
    // ma'nosiz: menyu allaqachon ekranni band qilmaydi.
    if (window.matchMedia('(max-width: 900px)').matches) {
      setMenuOpen((open) => !open)
      return
    }
    // Yozuvni updater ichida qilmaymiz: u toza funksiya bo'lishi kerak,
    // aks holda StrictMode uni ikki marta bajaradi.
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
    } catch {
      // localStorage o'chirilgan bo'lsa — shunchaki saqlanmaydi
    }
  }
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme())
  const data = useAdminData()

  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const go = useCallback((next: Route) => {
    window.location.hash = next
    setRoute(next)
    setMenuOpen(false)
  }, [])

  const newOrders = data.orders.filter((order) => order.status === 'Yangi').length
  const openState = getOpenState(data.hours)

  async function toggleOpen() {
    try {
      await saveSetting('hours', {
        ...data.hours,
        enabled: true,
        temporarilyClosed: !data.hours.temporarilyClosed,
      })
      toast(data.hours.temporarilyClosed ? 'Restoran ochildi' : 'Restoran vaqtincha yopildi')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Saqlanmadi', 'error')
    }
  }

  return (
    <div className={`adm-shell ${collapsed ? 'collapsed' : ''}`}>
      {menuOpen && (
        <div
          className="fixed inset-0 z-[65] bg-black/40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={`adm-sidebar ${menuOpen ? 'open' : ''}`}
        /* Yig'ilgan menyu Tab bilan ham, o'quvchi dastur uchun ham
           mavjud bo'lmasin. Kichik ekranda panel ochilsa — yana faol. */
        inert={collapsed && !menuOpen}
      >
        <div className="adm-logo">
          <img src={LOGO} alt={BRAND.fullName} className="adm-logo-mark object-cover" />
          <span>
            {BRAND.name}
            <span style={{ color: 'var(--brand)' }}> {BRAND.nameSuffix}</span>
          </span>
        </div>

        {NAV.map((item) => (
          <div key={item.id}>
            {item.group && <div className="adm-nav-group">{item.group}</div>}
            <button
              className={`adm-nav-item ${route === item.id ? 'active' : ''}`}
              onClick={() => go(item.id)}
            >
              <item.icon size={18} />
              {item.label}
              {item.id === 'orders' && newOrders > 0 && (
                <span className="adm-nav-badge">{newOrders}</span>
              )}
            </button>
          </div>
        ))}

        <div className="mt-auto pt-4">
          <div
            className="rounded-[var(--r-sm)] p-3 text-xs"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
          >
            <div className="truncate font-semibold" style={{ color: 'var(--ink)' }}>
              {email}
            </div>
            <button
              className="adm-btn ghost sm mt-2 w-full"
              onClick={() => signOutAdmin()}
              style={{ color: 'var(--danger)' }}
            >
              <LogOut size={15} />
              Chiqish
            </button>
          </div>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-topbar">
          <button
            className="adm-icon-btn adm-burger"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Menyuni ochish' : 'Menyuni yig‘ish'}
            title={collapsed ? 'Menyuni ochish' : 'Menyuni yig‘ish'}
          >
            <Menu size={20} className="adm-burger-mobile" />
            <span className="adm-burger-desktop">
              {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </span>
          </button>

          <span className="adm-title">{TITLES[route]}</span>

          <div className="ml-auto flex items-center gap-2">
            <button
              className="adm-btn sm"
              onClick={toggleOpen}
              title="Restoranni vaqtincha yopish yoki ochish"
              style={
                openState.open
                  ? { background: 'var(--success-soft)', color: 'var(--success)', borderColor: 'transparent' }
                  : { background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'transparent' }
              }
            >
              <span
                className="size-2 rounded-full"
                style={{ background: openState.open ? 'var(--success)' : 'var(--danger)' }}
              />
              {openState.open ? 'Ochiq' : 'Yopiq'}
            </button>

            <button
              className="adm-icon-btn"
              onClick={() => askNotificationPermission()}
              title="Brauzer bildirishnomalarini yoqish"
            >
              <Bell size={18} />
            </button>

            <button
              className="adm-icon-btn"
              onClick={() => {
                const next: ThemeMode = theme === 'dark' ? 'light' : 'dark'
                setTheme(next)
                storeTheme(next)
              }}
              title="Tema"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <div className="adm-content">
          {/*
             key={route} — o'ramni har safar yangidan yaratadi, shuning uchun
             kirish animatsiyasi har sahifa almashganda qaytadan ishlaydi.
          */}
          <div className="adm-page" key={route}>
          {route === 'dashboard' && <DashboardPage onNavigate={go} />}
          {route === 'orders' && <OrdersPage />}
          {route === 'products' && <ProductsPage />}
          {route === 'categories' && <CategoriesPage />}
          {route === 'promos' && <PromosPage />}
          {route === 'broadcast' && <BroadcastPage />}
          {route === 'customers' && <CustomersPage />}
          {route === 'stats' && <StatsPage />}
          {route === 'settings' && <SettingsPage />}
          {route === 'couriers' && <CouriersPage />}
          {route === 'channel' && <ChannelPage />}
          {route === 'admins' && <AdminsPage />}
          </div>
        </div>
      </div>
    </div>
  )
}

async function askNotificationPermission() {
  if (typeof Notification === 'undefined') {
    toast('Brauzer bildirishnomani qo‘llab-quvvatlamaydi', 'error')
    return
  }
  if (Notification.permission === 'granted') {
    toast('Bildirishnomalar allaqachon yoqilgan', 'info')
    return
  }
  const result = await Notification.requestPermission()
  toast(result === 'granted' ? 'Bildirishnomalar yoqildi' : 'Ruxsat berilmadi', result === 'granted' ? 'ok' : 'error')
}
