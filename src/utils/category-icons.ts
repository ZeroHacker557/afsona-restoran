import {
  Box, Gem, Grid2X2, Home, Laptop, Package, Shirt, ShoppingBag, Sparkles, Watch,
  type LucideIcon,
} from 'lucide-react'

/**
 * Kategoriya ikonkasi.
 *
 * Avval bazadagi `icon` maydoniga qaraydi (admin tanlagan), topilmasa
 * nom bo'yicha taxmin qiladi, u ham bo'lmasa umumiy quti ishlatiladi.
 * Ilgari faqat oldindan yozilgan nomlar bilan solishtirilardi, shuning
 * uchun har qanday yangi kategoriya doim quti bo'lib qolardi (F-17).
 */
const BY_KEY: Record<string, LucideIcon> = {
  all: Grid2X2,
  package: Package,
  bag: ShoppingBag,
  shirt: Shirt,
  clothes: Shirt,
  laptop: Laptop,
  electronics: Laptop,
  home: Home,
  gem: Gem,
  jewelry: Gem,
  shoes: Box,
  box: Box,
  watch: Watch,
  beauty: Sparkles,
  perfume: Sparkles,
}

const BY_NAME: [RegExp, LucideIcon][] = [
  [/kiyim|одежд|clothes/i, Shirt],
  [/elektron|электрон|texnika|laptop|telefon/i, Laptop],
  [/poyabzal|krossov|обув|shoes/i, Box],
  [/sumka|сумк|bag/i, ShoppingBag],
  [/parfum|parfyum|atir|парфюм|beauty|kosmetik/i, Sparkles],
  [/zargar|ювелир|oltin|jewel/i, Gem],
  [/soat|час|watch/i, Watch],
  [/uy|дом|home|mebel/i, Home],
  [/barcha|hamma|все|all/i, Grid2X2],
]

export function categoryIcon(icon?: string, name?: string): LucideIcon {
  if (icon) {
    const found = BY_KEY[icon.toLowerCase().trim()]
    if (found) return found
  }
  if (name) {
    for (const [pattern, Icon] of BY_NAME) {
      if (pattern.test(name)) return Icon
    }
  }
  return Package
}
