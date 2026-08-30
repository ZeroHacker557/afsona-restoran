import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import './admin.css'
import AdminApp from './AdminApp'
import { applyTheme, getStoredTheme } from '../utils/theme'
import { initInstall } from './lib/install'

// Tema birinchi bo'yoqdan oldin qo'llanadi — chaqnash bo'lmaydi
applyTheme(getStoredTheme())

// O'rnatish taklifini ushlab qolamiz (brauzer uni faqat bir marta beradi)
initInstall()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)
