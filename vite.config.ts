import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

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
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
})
