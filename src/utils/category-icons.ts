import {
  Beef,
  CakeSlice,
  Candy,
  Coffee,
  CookingPot,
  Croissant,
  Cookie,
  Drumstick,
  Fish,
  GlassWater,
  IceCreamCone,
  Salad,
  Sandwich,
  Soup,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from 'lucide-react'

/**
 * Kategoriya ikonkasi.
 *
 * Ikonka nomi Firestore'dagi kategoriya hujjatining `icon` maydonida
 * saqlanadi va admin panelda tanlanadi. Noma'lum nom kelsa — umumiy
 * taom ikonkasi ko'rsatiladi, ya'ni eski yozuvlar ham buzilmaydi.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  package: UtensilsCrossed,
  utensils: UtensilsCrossed,
  soup: Soup,
  pot: CookingPot,
  beef: Beef,
  drumstick: Drumstick,
  fish: Fish,
  salad: Salad,
  sandwich: Sandwich,
  bread: Wheat,
  croissant: Croissant,
  cake: CakeSlice,
  icecream: IceCreamCone,
  cookie: Cookie,
  candy: Candy,
  coffee: Coffee,
  drink: GlassWater,
}

/** Panelda tanlash uchun — ikonka nomi va o'zbekcha izohi. */
export const CATEGORY_ICON_LIST: { id: string; label: string }[] = [
  { id: 'utensils', label: 'Umumiy' },
  { id: 'soup', label: "Sho'rva" },
  { id: 'pot', label: 'Milliy taom' },
  { id: 'beef', label: "Go'sht" },
  { id: 'drumstick', label: 'Tovuq' },
  { id: 'fish', label: 'Baliq' },
  { id: 'salad', label: 'Salat' },
  { id: 'sandwich', label: 'Fast food' },
  { id: 'bread', label: 'Non' },
  { id: 'croissant', label: 'Pishiriq' },
  { id: 'cake', label: 'Tort' },
  { id: 'icecream', label: 'Muzqaymoq' },
  { id: 'cookie', label: 'Shirinlik' },
  { id: 'candy', label: 'Konfet' },
  { id: 'coffee', label: 'Issiq ichimlik' },
  { id: 'drink', label: 'Salqin ichimlik' },
]

export function categoryIcon(icon?: string): LucideIcon {
  return CATEGORY_ICONS[String(icon || '').toLowerCase()] || UtensilsCrossed
}
