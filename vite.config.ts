import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { devApi } from './vite-api-plugin.ts'

/**
 * Ikkita mustaqil sahifa quriladi:
 *
 *   index.html  → Telegram mini app (mijoz)
 *   admin.html  → /admin boshqaruv paneli
 *
 * Ajratilgani muhim: mijozning telefoniga admin paneli kodi umuman
 * yuklanmaydi, panel esa mini app cheklovlaridan (Telegram gate, safe area)
 * xoli bo'ladi.
 */
export default defineConfig({
  // devApi — `api/` papkasidagi Vercel funksiyalarini lokal serverda ham
  // ishlatadi. Production build'ga ta'sir qilmaydi.
  plugins: [react(), tailwindcss(), devApi()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
})
