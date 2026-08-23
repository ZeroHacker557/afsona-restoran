import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { TelegramGate } from './components/ui/TelegramGate'
import { isTelegram } from './utils/telegram'

// Production'da ilova faqat Telegram ichida ishlaydi. Tashqarida ochilsa
// Firestore'ga umuman ulanmaymiz (F-06). Dev rejimida brauzerda ishlash qoladi.
const insideTelegram = isTelegram() || import.meta.env.DEV

createRoot(document.getElementById('root')!).render(
  <StrictMode>{insideTelegram ? <App /> : <TelegramGate />}</StrictMode>,
)
