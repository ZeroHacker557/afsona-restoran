import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { TelegramGate } from './components/ui/TelegramGate'
import { I18nProvider } from './i18n'
import { applySafeArea, applyTelegramTheme, isTelegramEnvironment, waitForTelegram } from './utils/telegram'

const root = createRoot(document.getElementById('root')!)

function render(insideTelegram: boolean) {
  // Tema birinchi bo'yoqdan oldin qo'llanadi — "oq chaqnash" bo'lmaydi
  applyTelegramTheme()
  applySafeArea()

  root.render(
    <StrictMode>
      {insideTelegram ? (
        <I18nProvider>
          <App />
        </I18nProvider>
      ) : (
        <TelegramGate />
      )}
    </StrictMode>,
  )
}

if (isTelegramEnvironment() || import.meta.env.DEV) {
  render(true)
} else {
  // SDK skripti hali yuklanmagan bo'lishi mumkin — shoshilmaymiz
  waitForTelegram().then(() => render(isTelegramEnvironment()))
}
