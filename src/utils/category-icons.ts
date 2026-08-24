import { UtensilsCrossed, type LucideIcon } from 'lucide-react'

/**
 * Kategoriya ikonkasi.
 *
 * Restoran uchun barcha kategoriyalar bitta umumiy taom ikonkasidan
 * foydalanadi. Kategoriyalar keyinchalik bot orqali qo'shiladi, shuning
 * uchun nom yoki `icon` maydonidan qat'i nazar doim shu ikonka qaytadi.
 */
export function categoryIcon(_icon?: string, _name?: string): LucideIcon {
  return UtensilsCrossed
}
