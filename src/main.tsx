import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { TelegramGate } from './components/ui/TelegramGate'
import { isTelegramEnvironment, waitForTelegram } from './utils/telegram'

const root = createRoot(document.getElementById('root')!)

function render(insideTelegram: boolean) {
  root.render(
    <StrictMode>{insideTelegram ? <App /> : <TelegramGate />}</StrictMode>,
  )
}

// Telegram ichida bo'lsak — darhol ochamiz, kutmaymiz.
if (isTelegramEnvironment() || import.meta.env.DEV) {
  render(true)
} else {
  // SDK skripti hali yuklanmagan bo'lishi mumkin. Xulosani shoshilib
  // chiqarmaymiz: qisqa kutib, keyin qaytadan tekshiramiz. Aks holda
  // sekin internetda haqiqiy Telegram foydalanuvchisi ham to'siqqa uchraydi.
  waitForTelegram().then(() => render(isTelegramEnvironment()))
}
