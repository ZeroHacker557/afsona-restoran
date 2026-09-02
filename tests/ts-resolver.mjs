/**
 * `.js` → `.ts` moslashtiruvchi (test uchun).
 *
 * `api/` ichidagi fayllar bir-birini `.js` kengaytmasi bilan import
 * qiladi — bu Vercel'ning ESM talabi. Node esa TypeScript'ni o'zi
 * o'qiy oladi, lekin `.js` so'ralsa `.ts` faylni topmaydi.
 *
 * Bu hook shunday holatda yonidagi `.ts` faylga yo'naltiradi. Faqat
 * testlarda ishlatiladi — ishlab chiqarish kodiga umuman tegmaydi.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && specifier.endsWith('.js')) {
    try {
      const url = new URL(specifier, context.parentURL)
      const jsPath = fileURLToPath(url)
      if (!existsSync(jsPath)) {
        const tsPath = jsPath.slice(0, -3) + '.ts'
        if (existsSync(tsPath)) {
          // `format` ni o'zimiz bermaymiz — Node uni .ts kengaytmasidan
          // aniqlab, tip olib tashlashni o'zi qo'llasin
          return nextResolve(pathToFileURL(tsPath).href, context)
        }
      }
    } catch {
      // Yo'lni hisoblab bo'lmasa — odatdagi yo'l bilan davom etamiz
    }
  }
  return nextResolve(specifier, context)
}
