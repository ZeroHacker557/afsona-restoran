import { createContext, useContext } from 'react'
import type {
  AdminCategory,
  AdminOrder,
  AdminProduct,
  AdminPromo,
  AdminUser,
  BrandSettings,
  DeliverySettings,
  PaymentSettings,
} from './db'
import type { WorkingHours } from '../../utils/hours'

/**
 * Panelning umumiy ma'lumot konteksti.
 *
 * Provayder `store.tsx` da — u faqat komponent eksport qilishi kerak
 * (Fast Refresh talabi), shuning uchun kontekst va hook shu yerda.
 */
export type AdminData = {
  products: AdminProduct[]
  categories: AdminCategory[]
  orders: AdminOrder[]
  promos: AdminPromo[]
  users: AdminUser[]
  delivery: DeliverySettings
  payment: PaymentSettings
  brand: BrandSettings
  hours: WorkingHours
  /** Umumiy: taomlar va buyurtmalar keldimi. */
  loading: boolean
  /** Har bir kolleksiya alohida — skeletlarni shu bo'yicha ko'rsatamiz. */
  loaded: {
    products: boolean
    categories: boolean
    orders: boolean
    promos: boolean
    users: boolean
  }
  /** Sahifa ochilgandan keyin kelgan yangi buyurtmalar (belgilash uchun). */
  freshOrderIds: string[]
  markOrdersSeen: () => void
  /** Jonli ro'yxatga nechta buyurtma olinyapti. */
  ordersLimit: number
  /** Chegaraga yetildimi — «Ko'proq yuklash» tugmasini shu hal qiladi. */
  ordersAtLimit: boolean
  /** Chegarani oshiradi (yana bir sahifa). */
  loadMoreOrders: () => void
}

export const DataContext = createContext<AdminData | null>(null)

export function useAdminData(): AdminData {
  const value = useContext(DataContext)
  if (!value) throw new Error('AdminDataProvider ichida ishlatilishi kerak')
  return value
}
