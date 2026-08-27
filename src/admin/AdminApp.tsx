import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3,
  Bell,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Ticket,
  UtensilsCrossed,
  Users,
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
import { AdminsPage } from './pages/AdminsPage'
import { ToastHost } from './components/Toast'
import { toast } from './lib/toast'
import { Spinner } from './components/ui'
import { BRAND } from '../config/brand'
import { applyTheme, getStoredTheme, storeTheme, type ThemeMode } from '../utils/theme'
import { getOpenState } from '../utils/hours'
import { saveSetting } from './lib/db'

type Route =
  | 'dashboard' | 'orders' | 'products' | 'categories' | 'promos'
  | 'broadcast' | 'customers' | 'stats' | 'settings' | 'admins'

const NAV: { id: Route; label: string; icon: typeof LayoutDashboard; group?: string }[] = [
  { id: 'dashboard', label: 'Bosh sahifa', icon: LayoutDashboard },
  { id: 'orders', label: 'Buyurtmalar', icon: ShoppingBag },
  { id: 'products', label: 'Taomlar', icon: UtensilsCrossed, group: 'Katalog' },
  { id: 'categories', label: 'Kategoriyalar', icon: FolderTree },
  { id: 'promos', label: 'Promokodlar', icon: Ticket },
  { id: 'broadcast', label: 'Xabarnoma', icon: Megaphone, group: 'Mijozlar' },
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
  admins: 'Adminlar',
}

function readRoute(): Route {
  const hash = window.location.hash.replace('#', '') as Route
  return TITLES[hash] ? hash : 'dashboard'
}

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
        <LoginPage onDone={() => setState('checking')} />
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
    <div className="adm-shell">
      {menuOpen && (
        <div
          className="fixed inset-0 z-[65] bg-black/40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`adm-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="adm-logo">
          <span className="adm-logo-mark">
            <UtensilsCrossed size={20} />
          </span>
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
          <button className="adm-icon-btn adm-burger" onClick={() => setMenuOpen(true)} aria-label="Menyu">
            <Menu size={20} />
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
          {route === 'dashboard' && <DashboardPage onNavigate={go} />}
          {route === 'orders' && <OrdersPage />}
          {route === 'products' && <ProductsPage />}
          {route === 'categories' && <CategoriesPage />}
          {route === 'promos' && <PromosPage />}
          {route === 'broadcast' && <BroadcastPage />}
          {route === 'customers' && <CustomersPage />}
          {route === 'stats' && <StatsPage />}
          {route === 'settings' && <SettingsPage />}
          {route === 'admins' && <AdminsPage />}
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
