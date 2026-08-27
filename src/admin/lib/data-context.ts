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
  loading: boolean
  /** Sahifa ochilgandan keyin kelgan yangi buyurtmalar (belgilash uchun). */
  freshOrderIds: string[]
  markOrdersSeen: () => void
}

export const DataContext = createContext<AdminData | null>(null)

export function useAdminData(): AdminData {
  const value = useContext(DataContext)
  if (!value) throw new Error('AdminDataProvider ichida ishlatilishi kerak')
  return value
}
